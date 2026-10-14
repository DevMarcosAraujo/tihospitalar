import { useState } from 'react';
import { Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { useApi, useDebounced } from '../../api/useApi';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Empty, ErrorMsg, Loading, Options, PageHeader, SearchBox } from '../../components/ui';
import { STATUS_EQUIP, nomeEquip } from '../../utils/format';
import EquipamentoForm from './EquipamentoForm';

// Computador: impressoras ligadas a ele · Impressora: computador ao qual está ligada
export const ligacao = (e) => {
  if (e.impressoras?.length) return e.impressoras.map((i) => [i.tipo, i.modelo].filter(Boolean).join(' ')).join(', ');
  if (e.ligado_a_id) return `Ligada a ${e.ligado_a_hostname || e.ligado_a_patrimonio || 'computador'}`;
  return '—';
};

export default function Equipamentos() {
  const { isAdmin } = useAuth();
  const [q, setQ] = useState('');
  const [filtros, setFiltros] = useState({ unidade_id: '', setor_id: '', categoria_id: '', status: '' });
  const [inativos, setInativos] = useState(false);
  const [modal, setModal] = useState(null);
  const [erro, setErro] = useState('');
  const busca = useDebounced(q);

  const unidades = useApi('/unidades');
  const categorias = useApi('/equipamentos/categorias');
  const setoresFiltro = useApi(filtros.unidade_id ? '/setores' : null, { unidade_id: filtros.unidade_id });
  const { data, loading, error, reload } = useApi('/equipamentos', { ...filtros, q: busca, inativos });
  const setFiltro = (k) => (e) => setFiltros({ ...filtros, [k]: e.target.value, ...(k === 'unidade_id' ? { setor_id: '' } : {}) });

  // Novo equipamento já nasce com a unidade/setor que estiverem filtrados
  const novo = () => setModal({ inicial: { unidade_id: filtros.unidade_id, setor_id: filtros.setor_id } });

  async function alternar(eq) {
    setErro('');
    try { await api(`/equipamentos/${eq.id}/ativo`, { method: 'PATCH', body: { ativo: eq.status === 'INATIVO' } }); reload(); }
    catch (err) { setErro(err.message); }
  }

  async function excluir(eq) {
    if (!window.confirm(`Excluir "${nomeEquip(eq)}" definitivamente? Esta ação não pode ser desfeita.`)) return;
    setErro('');
    try { await api(`/equipamentos/${eq.id}`, { method: 'DELETE' }); reload(); }
    catch (err) { setErro(err.message); }
  }

  return (
    <>
      <PageHeader title="Equipamentos" subtitle={data ? `${data.length} equipamento(s)` : ''}>
        <button className="btn btn-primary" onClick={novo}><Plus size={18} /> Novo equipamento</button>
      </PageHeader>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Hostname, TeamViewer, patrimônio, IP…" />
        <select value={filtros.unidade_id} onChange={setFiltro('unidade_id')}><Options items={unidades.data} vazio="Todas as unidades" /></select>
        <select value={filtros.setor_id} onChange={setFiltro('setor_id')} disabled={!filtros.unidade_id}><Options items={setoresFiltro.data} vazio="Todos os setores" /></select>
        <select value={filtros.categoria_id} onChange={setFiltro('categoria_id')}><Options items={categorias.data} vazio="Todas as categorias" /></select>
        <select value={filtros.status} onChange={setFiltro('status')}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_EQUIP).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={inativos} onChange={(e) => setInativos(e.target.checked)} /> Mostrar inativos</label>
      </div>
      <ErrorMsg>{erro || error}</ErrorMsg>
      <div className="table-wrap">
        {loading && !data ? <Loading /> : !data?.length ? (
          <Empty>
            Nenhum equipamento encontrado.
            <div style={{ marginTop: '1rem' }}><button className="btn btn-primary" onClick={novo}><Plus size={18} /> Adicionar equipamento</button></div>
          </Empty>
        ) : (
          <table>
            <thead><tr><th>Equipamento</th><th>Tipo</th><th>Unidade / Setor</th><th>TeamViewer</th><th>Impressora</th><th>IP</th><th>Status</th>{isAdmin && <th />}</tr></thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id} className={e.status === 'INATIVO' ? 'inativo' : ''}>
                  <td><strong>{nomeEquip(e)}</strong><div className="muted">{e.categoria}{e.patrimonio && e.hostname ? ` · ${e.patrimonio}` : ''}</div></td>
                  <td>{e.tipo}</td>
                  <td><div>{e.unidade_nome}<div className="muted">{e.setor_nome}{e.sala ? ` · ${e.sala}` : ''}</div></div></td>
                  <td>{e.teamviewer || '—'}</td>
                  <td>{ligacao(e)}</td>
                  <td>{e.ip || '—'}</td>
                  <td><Badge map={STATUS_EQUIP} value={e.status} /></td>
                  {isAdmin && (
                    <td className="acoes">
                      <button className="icon-btn" title="Editar" onClick={() => setModal({ equip: e })}><Pencil size={17} /></button>
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
      <button className="fab" onClick={novo} aria-label="Novo equipamento"><Plus size={26} /></button>
      {modal && (
        <EquipamentoForm equip={modal.equip} inicial={modal.inicial} categorias={categorias.data} unidades={unidades.data}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />
      )}
    </>
  );
}
