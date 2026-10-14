import { useState } from 'react';
import { Download } from 'lucide-react';
import { baixarCsv } from '../../api/client';
import { useApi } from '../../api/useApi';
import { Empty, ErrorMsg, Loading, Options, PageHeader } from '../../components/ui';
import { fmtAny, humanize } from '../../utils/format';

const ABAS = [
  { id: 'equipamentos', titulo: 'Equipamentos', filtros: ['unidade'] },
  { id: 'tarefas', titulo: 'Tarefas', filtros: ['tecnico', 'status', 'periodo'] },
  { id: 'problemas', titulo: 'Problemas', filtros: ['periodo'] },
];

const STATUS = [['ABERTA', 'Aberta'], ['EM_ANDAMENTO', 'Em andamento'], ['CONCLUIDA', 'Concluída'], ['ATRASADA', 'Atrasada']];

export default function Relatorios() {
  const [aba, setAba] = useState(ABAS[0]);
  const [f, setF] = useState({ unidade_id: '', tecnico_id: '', status: '', de: '', ate: '' });
  const [erro, setErro] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const unidades = useApi('/unidades');
  const tecnicos = useApi('/usuarios', { perfil: 'TECNICO' });

  // Só envia os filtros que a aba usa
  const params = {};
  if (aba.filtros.includes('unidade')) params.unidade_id = f.unidade_id;
  if (aba.filtros.includes('tecnico')) params.tecnico_id = f.tecnico_id;
  if (aba.filtros.includes('status')) params.status = f.status;
  if (aba.filtros.includes('periodo')) { params.de = f.de; params.ate = f.ate; }

  const { data, loading, error } = useApi(`/relatorios/${aba.id}`, params);

  async function exportar() {
    setErro('');
    try { await baixarCsv(`/relatorios/${aba.id}`, params, `relatorio-${aba.id}`); }
    catch (e) { setErro(e.message); }
  }

  const celula = (col, v) => {
    if (v === null || v === undefined || v === '') return '—';
    return col.date ? fmtAny(v) : humanize(v);
  };

  return (
    <>
      <PageHeader title="Relatórios" subtitle="Visualização em tabela com exportação para CSV">
        <button className="btn btn-primary" onClick={exportar} disabled={!data?.linhas?.length}><Download size={18} /> Exportar CSV</button>
      </PageHeader>

      <div className="tabs">
        {ABAS.map((a) => <button key={a.id} className={`tab ${a.id === aba.id ? 'ativa' : ''}`} onClick={() => setAba(a)}>{a.titulo}</button>)}
      </div>

      <div className="toolbar">
        {aba.filtros.includes('unidade') && <select value={f.unidade_id} onChange={set('unidade_id')}><Options items={unidades.data} vazio="Todas as unidades" /></select>}
        {aba.filtros.includes('tecnico') && <select value={f.tecnico_id} onChange={set('tecnico_id')}><Options items={tecnicos.data} vazio="Todos os técnicos" /></select>}
        {aba.filtros.includes('status') && (
          <select value={f.status} onChange={set('status')}>
            <option value="">Todos os status</option>
            {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        )}
        {aba.filtros.includes('periodo') && (
          <>
            <input type="date" value={f.de} onChange={set('de')} aria-label="De" />
            <input type="date" value={f.ate} onChange={set('ate')} aria-label="Até" />
          </>
        )}
      </div>

      <ErrorMsg>{erro || error}</ErrorMsg>
      <div className="table-wrap">
        {loading && !data ? <Loading /> : !data?.linhas?.length ? <Empty /> : (
          <table>
            <thead><tr>{data.colunas.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
            <tbody>
              {data.linhas.map((l, i) => (
                <tr key={i}>{data.colunas.map((c) => <td key={c.key}>{celula(c, l[c.key])}</td>)}</tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
