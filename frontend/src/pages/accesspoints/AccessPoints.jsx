import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { useApi, useDebounced } from '../../api/useApi';
import { useAuth } from '../../auth/AuthContext';
import { Empty, ErrorMsg, Field, FormActions, Loading, Modal, PageHeader, SearchBox } from '../../components/ui';

// Mesma regra do servidor: maiúsculo, sem acento, "_" no lugar de espaços
const limpa = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const nomeAp = (f) => `AP_${limpa(f.numero) || 'NUM'}_PT_${limpa(f.ponto) || 'NUMERO'}`;
const nomeCabo = (f) => `CABO_SW_${limpa(f.rack) || 'RACK'}_PT_${limpa(f.porta) || 'PORTA'}`;

function ApForm({ ap, setores, onClose, onSaved }) {
  const [f, setF] = useState({
    setor_id: ap?.setor_id || '', numero: ap?.numero || '', ponto: ap?.ponto || '',
    rack: ap?.rack || '', porta: ap?.porta || '', observacoes: ap?.observacoes || '',
  });
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const porDivisao = useMemo(() => {
    const m = {};
    (setores || []).forEach((s) => { (m[s.localizacao || 'Sem divisão'] ||= []).push(s); });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
  }, [setores]);

  async function salvar(e) {
    e.preventDefault();
    setSaving(true); setErro('');
    try {
      await api(ap ? `/access-points/${ap.id}` : '/access-points', { method: ap ? 'PUT' : 'POST', body: f });
      onSaved();
    } catch (err) { setErro(err.message); setSaving(false); }
  }

  return (
    <Modal title={ap ? 'Editar Access Point' : 'Novo Access Point'} onClose={onClose}>
      <form onSubmit={salvar}>
        <ErrorMsg>{erro}</ErrorMsg>
        <div className="form-grid">
          <Field label="Setor" required className="full">
            <select value={f.setor_id} onChange={set('setor_id')} required>
              <option value="">Selecione…</option>
              {porDivisao.map(([div, lista]) => (
                <optgroup key={div} label={div}>{lista.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</optgroup>
              ))}
            </select>
          </Field>
          <Field label="Número do AP" required className="lado"><input value={f.numero} onChange={set('numero')} required inputMode="numeric" placeholder="Ex.: 12" autoFocus /></Field>
          <Field label="Número do ponto (PT)" required className="lado"><input value={f.ponto} onChange={set('ponto')} required placeholder="Ex.: 205" /></Field>
          <Field label="Nome do rack / switch" required className="lado"><input value={f.rack} onChange={set('rack')} required placeholder="Ex.: RACK 02" /></Field>
          <Field label="Porta do rack" required className="lado"><input value={f.porta} onChange={set('porta')} required inputMode="numeric" placeholder="Ex.: 24" /></Field>
          <Field label="Observações" className="full"><input value={f.observacoes} onChange={set('observacoes')} placeholder="Opcional" /></Field>
        </div>
        <div className="sigla-previa">
          <div><span>Nome do AP</span><strong>{nomeAp(f)}</strong></div>
          <div><span>Etiqueta do cabo</span><strong>{nomeCabo(f)}</strong></div>
        </div>
        <FormActions onCancel={onClose} saving={saving} disabled={!f.setor_id} label="Salvar" />
      </form>
    </Modal>
  );
}

export default function AccessPoints() {
  const { isAdmin, unidadeId } = useAuth();
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const [erro, setErro] = useState('');
  const busca = useDebounced(q);
  const setores = useApi('/setores', { unidade_id: unidadeId });
  const { data, loading, error, reload } = useApi('/access-points', { q: busca });

  async function excluir(a) {
    if (!window.confirm(`Excluir ${a.nome_ap} definitivamente?`)) return;
    setErro('');
    try { await api(`/access-points/${a.id}`, { method: 'DELETE' }); reload(); }
    catch (err) { setErro(err.message); }
  }

  return (
    <>
      <PageHeader title="Access Points" subtitle={data ? `${data.length} AP(s) cadastrado(s)` : ''}>
        <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={18} /> Novo AP</button>
      </PageHeader>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Nome do AP, cabo, rack ou setor…" />
      </div>
      <ErrorMsg>{erro || error}</ErrorMsg>
      <div className="table-wrap">
        {loading && !data ? <Loading /> : !data?.length ? <Empty>Nenhum Access Point cadastrado.</Empty> : (
          <table>
            <thead><tr><th>Access Point</th><th>Setor</th><th>Cabo (switch)</th><th>Rack</th><th>Porta</th>{isAdmin && <th />}</tr></thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <td><strong>{a.nome_ap}</strong>{a.observacoes && <div className="muted">{a.observacoes}</div>}</td>
                  <td>{a.setor_nome || '—'}{a.divisao && <div className="muted">{a.divisao}</div>}</td>
                  <td>{a.nome_cabo}</td>
                  <td>{a.rack}</td>
                  <td>{a.porta}</td>
                  {isAdmin && (
                    <td className="acoes">
                      <button className="icon-btn" title="Editar" onClick={() => setModal({ ap: a })}><Pencil size={17} /></button>
                      <button className="icon-btn" title="Excluir" onClick={() => excluir(a)}><Trash2 size={17} color="var(--red)" /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <button className="fab" onClick={() => setModal({})} aria-label="Novo AP"><Plus size={26} /></button>
      {modal && <ApForm ap={modal.ap} setores={setores.data} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />}
    </>
  );
}
