import { useState } from 'react';
import { Pencil, Plus, Power } from 'lucide-react';
import { api } from '../../api/client';
import { useApi, useDebounced } from '../../api/useApi';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Empty, ErrorMsg, Field, FormActions, Loading, Modal, PageHeader, SearchBox } from '../../components/ui';

const ATIVO = { true: ['Ativa', 'green'], false: ['Inativa', 'gray'] };
const VAZIO = { nome: '', codigo: '', endereco: '', telefone: '', observacoes: '', ativo: true };

function UnidadeForm({ unidade, onClose, onSaved }) {
  const [f, setF] = useState(unidade ? { ...VAZIO, ...unidade } : VAZIO);
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function salvar(e) {
    e.preventDefault();
    setSaving(true); setErro('');
    try {
      await api(unidade ? `/unidades/${unidade.id}` : '/unidades', { method: unidade ? 'PUT' : 'POST', body: f });
      onSaved();
    } catch (err) { setErro(err.message); setSaving(false); }
  }

  return (
    <Modal title={unidade ? 'Editar unidade' : 'Nova unidade'} onClose={onClose}>
      <form onSubmit={salvar}>
        <ErrorMsg>{erro}</ErrorMsg>
        <div className="form-grid">
          <Field label="Nome" required className="full"><input value={f.nome} onChange={set('nome')} required autoFocus={!unidade} /></Field>
          <Field label="Código" required><input value={f.codigo} onChange={set('codigo')} required placeholder="HC01" /></Field>
          <Field label="Telefone"><input value={f.telefone || ''} onChange={set('telefone')} inputMode="tel" /></Field>
          <Field label="Endereço / localização" className="full"><input value={f.endereco || ''} onChange={set('endereco')} /></Field>
          <Field label="Status" className="full">
            <select value={String(f.ativo)} onChange={(e) => setF({ ...f, ativo: e.target.value === 'true' })}>
              <option value="true">Ativa</option><option value="false">Inativa</option>
            </select>
          </Field>
          <Field label="Observações" className="full"><textarea value={f.observacoes || ''} onChange={set('observacoes')} /></Field>
        </div>
        <FormActions onCancel={onClose} saving={saving} />
      </form>
    </Modal>
  );
}

export default function Unidades() {
  const { isAdmin } = useAuth();
  const [q, setQ] = useState('');
  const [inativos, setInativos] = useState(false);
  const [modal, setModal] = useState(null); // null | {} (nova) | unidade
  const [erro, setErro] = useState('');
  const busca = useDebounced(q);
  const { data, loading, error, reload } = useApi('/unidades', { q: busca, inativos });

  async function alternar(u) {
    setErro('');
    try { await api(`/unidades/${u.id}/ativo`, { method: 'PATCH', body: { ativo: !u.ativo } }); reload(); }
    catch (err) { setErro(err.message); }
  }

  return (
    <>
      <PageHeader title="Unidades" subtitle="Unidades e quantidade de divisões">
        {isAdmin && <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={18} /> Nova unidade</button>}
      </PageHeader>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Buscar por nome ou código…" />
        <label className="check"><input type="checkbox" checked={inativos} onChange={(e) => setInativos(e.target.checked)} /> Mostrar inativas</label>
      </div>
      <ErrorMsg>{erro || error}</ErrorMsg>
      <div className="table-wrap">
        {loading && !data ? <Loading /> : !data?.length ? <Empty /> : (
          <table>
            <thead><tr><th>Unidade</th><th>Divisões</th>{isAdmin && <th />}</tr></thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id} className={u.ativo ? "" : "inativo"}>
                  <td><strong>{u.nome}</strong></td>
                  <td>{u.total_divisoes}</td>
                  {isAdmin && (
                    <td className="acoes" onClick={(e) => e.stopPropagation()}>
                      <button className="icon-btn" title="Editar" onClick={() => setModal(u)}><Pencil size={17} /></button>
                      <button className="icon-btn" title={u.ativo ? 'Inativar' : 'Reativar'} onClick={() => alternar(u)}><Power size={17} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {modal && <UnidadeForm unidade={modal.id ? modal : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />}
    </>
  );
}
