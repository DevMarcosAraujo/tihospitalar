import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowRightLeft, Laptop, Monitor, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { useApi, useDebounced } from '../../api/useApi';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Empty, ErrorMsg, Field, FormActions, Loading, Modal, PageHeader, SearchBox } from '../../components/ui';
import { STATUS_EQUIP, nomeEquip } from '../../utils/format';
import EquipamentoForm from '../equipamentos/EquipamentoForm';
import EquipamentoDetalhe from '../equipamentos/EquipamentoDetalhe';
import { ligacao } from '../equipamentos/Equipamentos';
import { SetorEditado, SetorForm } from './Setores';

// Administrador: leva um ou vários equipamentos para outro setor da mesma unidade
function MoverForm({ itens, setor, onClose, onSaved }) {
  const setores = useApi('/setores', { unidade_id: setor.unidade_id });
  const [destino, setDestino] = useState('');
  const [sala, setSala] = useState('');
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);
  const porDivisao = useMemo(() => {
    const m = {};
    (setores.data || []).filter((x) => x.id !== setor.id).forEach((x) => { (m[x.localizacao || 'Sem divisão'] ||= []).push(x); });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
  }, [setores.data, setor.id]);

  async function mover(e) {
    e.preventDefault();
    setSaving(true); setErro('');
    try {
      const r = await api('/equipamentos/mover', { method: 'POST', body: { ids: itens.map((i) => i.id), setor_id: destino, sala } });
      onSaved(r);
    } catch (err) { setErro(err.message); setSaving(false); }
  }

  return (
    <Modal title="Mover equipamento" onClose={onClose}>
      <form onSubmit={mover}>
        <ErrorMsg>{erro}</ErrorMsg>
        <p style={{ marginTop: 0 }}>
          {itens.length === 1 ? <strong>{nomeEquip(itens[0])}</strong> : <strong>{itens.length} equipamentos</strong>} de <strong>{setor.nome}</strong> para outro setor de {setor.unidade_nome}:
        </p>
        <div className="form-grid">
          <Field label="Setor de destino" required className="full">
            <select value={destino} onChange={(e) => setDestino(e.target.value)} required autoFocus>
              <option value="">Selecione…</option>
              {porDivisao.map(([div, lista]) => (
                <optgroup key={div} label={div}>{lista.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</optgroup>
              ))}
            </select>
          </Field>
          {itens.length === 1 && <Field label="Guichê / posição no novo setor" className="full" hint="Opcional. A posição anterior é apagada."><input value={sala} onChange={(e) => setSala(e.target.value)} /></Field>}
        </div>
        <p className="muted">Impressoras ligadas a um computador movido ficam sem ligação até serem ligadas de novo. A movimentação fica registrada em Atividades.</p>
        <FormActions onCancel={onClose} saving={saving} disabled={!destino} label="Mover" />
      </form>
    </Modal>
  );
}

export default function SetorDetalhe() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const [q, setQ] = useState('');
  const [aba, setAba] = useState('pc');
  const [modelo, setModelo] = useState('');
  const [novo, setNovo] = useState(false);
  const [edit, setEdit] = useState(null);
  const [ver, setVer] = useState(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [sel, setSel] = useState([]); // equipamentos marcados para mover
  const [mover, setMover] = useState(null);
  const [editSetor, setEditSetor] = useState(false);
  const [editado, setEditado] = useState(null);
  const busca = useDebounced(q);
  const setor = useApi(`/setores/${id}`);
  const unidades = useApi('/unidades');
  const irmaos = useApi(setor.data ? '/setores' : null, { unidade_id: setor.data?.unidade_id, inativos: true });
  const divisoes = useMemo(() => [...new Set((irmaos.data || []).map((x) => x.localizacao).filter(Boolean))].sort(), [irmaos.data]);
  const categorias = useApi('/equipamentos/categorias');
  // O administrador também vê os inativos, para poder reativá-los
  const equips = useApi('/equipamentos', { setor_id: id, q: busca, inativos: isAdmin });
  const ABAS = [
    { id: 'pc', label: 'Computadores', cat: 'Computadores' },
    { id: 'impressora', label: 'Impressoras', cat: 'Impressoras' },
    { id: 'tv', label: 'TVs / Painéis', cat: 'Audiovisual' },
  ];
  const todos = equips.data || [];
  const daAba = (a) => todos.filter((e) => !a.cat || e.categoria === a.cat);
  const abaAtual = ABAS.find((a) => a.id === aba);
  // Sub-filtro da aba: Desktop/Notebook nos computadores, modelo nas impressoras
  const modelos = aba === 'pc' || aba === 'impressora' ? [...new Set(daAba(abaAtual).map((e) => e.tipo))].sort() : [];
  const chave = (e) => e.hostname || e.nome || e.ligado_a_hostname || e.numero_serie || e.tipo || '';
  const visiveis = daAba(abaAtual)
    .filter((e) => !modelo || e.tipo === modelo)
    .sort((a, b) => {
      const nat = (x, y) => x.localeCompare(y, 'pt-BR', { numeric: true, sensitivity: 'base' });
      const ga = a.sala || '', gb = b.sala || '';
      if (!ga !== !gb) return ga ? -1 : 1; // sem guichê por último
      return nat(ga, gb) || nat(chave(a), chave(b));
    });
  // Host: o do próprio equipamento; impressora sem host mostra o PC ao qual está ligada (ou o IP)
  const hostDe = (e) => (aba === 'impressora' ? e.ip || e.hostname : e.hostname || (e.ligado_a_hostname ? `PC ${e.ligado_a_hostname}` : e.ip)) || '—';

  const recarregar = () => { setor.reload(); equips.reload(); setSel([]); };
  const marcados = visiveis.filter((e) => sel.includes(e.id));
  const alternaSel = (id) => setSel((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const todosMarcados = visiveis.length > 0 && marcados.length === visiveis.length;

  async function alternar(e) {
    setErro('');
    try { await api(`/equipamentos/${e.id}/ativo`, { method: 'PATCH', body: { ativo: e.status === 'INATIVO' } }); recarregar(); }
    catch (err) { setErro(err.message); }
  }

  async function excluir(e) {
    if (!window.confirm(`Excluir "${nomeEquip(e)}" definitivamente? Esta ação não pode ser desfeita.`)) return;
    setErro('');
    try { await api(`/equipamentos/${e.id}`, { method: 'DELETE' }); recarregar(); }
    catch (err) { setErro(err.message); }
  }

  const s = setor.data;
  if (setor.loading && !s) return <Loading />;
  if (setor.error) return <ErrorMsg>{setor.error}</ErrorMsg>;

  return (
    <>
      <PageHeader title={s.nome} subtitle={s.localizacao ? `${s.unidade_nome} · ${s.localizacao}` : s.unidade_nome} back="/setores">
        {isAdmin && <button className="btn" onClick={() => setEditSetor(true)}><Pencil size={18} /> Editar setor</button>}
        <button className="btn btn-primary" onClick={() => setNovo(true)}><Plus size={18} /> Adicionar equipamento</button>
      </PageHeader>
      <div className="card">
        <dl className="info-grid">
          <div><dt>Divisão</dt><dd>{s.localizacao || '—'}</dd></div>
          <div><dt>Responsável</dt><dd>{s.responsavel || '—'}</dd></div>
          <div><dt>Ramal</dt><dd>{s.ramal || '—'}</dd></div>
          <div><dt>Observações</dt><dd>{s.observacoes || '—'}</dd></div>
        </dl>
      </div>

      <h2 className="mt">Resumo por categoria</h2>
      {s.resumo_categorias.length ? (
        <div className="chips">
          {s.resumo_categorias.map((c) => <span key={c.categoria_id} className="chip">{c.categoria}: {c.total}</span>)}
        </div>
      ) : <p className="muted">Sem equipamentos neste setor.</p>}

      <h2>Equipamentos</h2>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Hostname, TeamViewer, patrimônio, IP…" />
        
      </div>
      {ver && <EquipamentoDetalhe equip={ver} onClose={() => setVer(null)} />}
      <div className="mapa-abas">
        {ABAS.map((a) => (
          <button key={a.id} className={aba === a.id ? 'ativo' : ''} onClick={() => { setAba(a.id); setModelo(''); }}>
            {a.label} <span className="mapa-qtd">{daAba(a).length}</span>
          </button>
        ))}
      </div>
      {modelos.length > 1 && (
        <div className="divisoes">
          <button className={!modelo ? 'ativo' : ''} onClick={() => setModelo('')}>Todas</button>
          {modelos.map((m) => <button key={m} className={modelo === m ? 'ativo' : ''} onClick={() => setModelo(m)}>{m}</button>)}
        </div>
      )}
      <ErrorMsg>{erro}</ErrorMsg>
      {aviso && <div className="alert alert-ok">{aviso}</div>}
      {isAdmin && marcados.length > 0 && (
        <div className="toolbar"><button className="btn btn-primary" onClick={() => setMover(marcados)}><ArrowRightLeft size={16} /> Mover {marcados.length} selecionado(s)</button></div>
      )}
      <div className="table-wrap">
        {equips.loading && !equips.data ? <Loading /> : !visiveis.length ? <Empty>Nenhum equipamento nesta aba.</Empty> : (
          <table>
            <thead>
              <tr>{isAdmin && <th style={{ width: 34 }}><input type="checkbox" checked={todosMarcados} onChange={() => setSel(todosMarcados ? [] : visiveis.map((e) => e.id))} aria-label="Selecionar todos" /></th>}<th>Equipamento</th><th>Host</th><th>{aba === 'impressora' ? 'Hostname da máquina' : 'Guichê'}</th>{isAdmin && <th />}</tr>
            </thead>
            <tbody>
              {visiveis.map((e) => (
                <tr key={e.id} className={`clicavel ${e.status === 'INATIVO' ? 'inativo' : ''}`} onClick={() => setVer(e)}>
                  {isAdmin && <td onClick={(ev) => ev.stopPropagation()}><input type="checkbox" checked={sel.includes(e.id)} onChange={() => alternaSel(e.id)} aria-label="Selecionar" /></td>}
                  <td>{aba === 'pc' && (e.tipo === 'Notebook' ? <Laptop size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} /> : <Monitor size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />)}<strong>{e.nome || e.tipo}</strong>{aba === 'impressora' && !e.nome && <span className="pendente" title="Atenção: falta o nome padrão. O técnico deve ir até a impressora e atualizar as informações.">?</span>}{aba === 'impressora' && e.nome && <div className="muted">{[e.tipo, e.fabricante, e.modelo].filter(Boolean).join(' · ')}</div>}{e.status !== 'ATIVO' && <> <Badge map={STATUS_EQUIP} value={e.status} /></>}</td>
                  <td>{hostDe(e)}</td>
                  <td>{aba === 'impressora' ? e.ligado_a_hostname || '—' : e.sala || '—'}</td>
                  {isAdmin && (
                    <td className="acoes" onClick={(ev) => ev.stopPropagation()}>
                      <button className="icon-btn" title="Editar" onClick={() => setEdit(e)}><Pencil size={17} /></button>
                      <button className="icon-btn" title="Mover para outro setor" onClick={() => setMover([e])}><ArrowRightLeft size={17} /></button>
                      <button className="icon-btn" title={e.status === 'INATIVO' ? 'Reativar' : 'Inativar'} onClick={() => alternar(e)}><Power size={17} /></button>
                      <button className="icon-btn" title="Excluir" onClick={() => excluir(e)}><Trash2 size={17} color="var(--red)" /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <button className="fab" onClick={() => setNovo(true)} aria-label="Adicionar equipamento"><Plus size={26} /></button>
      {edit && (
        <EquipamentoForm equip={edit} categorias={categorias.data} unidades={unidades.data}
          onClose={() => setEdit(null)} onSaved={() => { setEdit(null); recarregar(); }} />
      )}
      {mover && (
        <MoverForm itens={mover} setor={s} onClose={() => setMover(null)}
          onSaved={(r) => { setMover(null); recarregar(); setAviso(`${r.movidos} equipamento(s) movido(s) para ${r.setor}.${r.impressoras_desligadas ? ` ${r.impressoras_desligadas} impressora(s) ficaram sem ligação.` : ''}`); }} />
      )}
      {editSetor && (
        <SetorForm setor={s} unidades={unidades.data} divisoes={divisoes} onClose={() => setEditSetor(false)}
          onSaved={(r) => { setEditSetor(false); recarregar(); irmaos.reload(); if (r) setEditado(r); }} />
      )}
      {editado && <SetorEditado setor={editado} onClose={() => setEditado(null)} />}
      {novo && (
        <EquipamentoForm inicial={{ unidade_id: s.unidade_id, setor_id: s.id }} categorias={categorias.data} unidades={unidades.data}
          onClose={() => setNovo(false)} onSaved={() => { setNovo(false); recarregar(); }} />
      )}
    </>
  );
}
