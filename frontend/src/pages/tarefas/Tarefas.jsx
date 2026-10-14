import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useApi, useDebounced } from '../../api/useApi';
import { useAuth } from '../../auth/AuthContext';
import { ErrorMsg, Loading, Options, PageHeader, SearchBox } from '../../components/ui';
import TarefasTabela from '../../components/TarefasTabela';
import { PRIORIDADE, STATUS_TAREFA } from '../../utils/format';
import TarefaForm from './TarefaForm';
import { useNavigate } from 'react-router-dom';

export default function Tarefas() {
  const { isAdmin } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [f, setF] = useState({ unidade_id: '', setor_id: '', tecnico_id: '', status: '', prioridade: '', campo: 'criacao', de: '', ate: '' });
  const [novo, setNovo] = useState(false);
  const busca = useDebounced(q);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value, ...(k === 'unidade_id' ? { setor_id: '' } : {}) });

  const unidades = useApi('/unidades');
  const setores = useApi(f.unidade_id ? '/setores' : null, { unidade_id: f.unidade_id });
  const tecnicos = useApi(isAdmin ? '/usuarios' : null, { perfil: 'TECNICO' });
  const { data, loading, error } = useApi('/tarefas', { ...f, q: busca });

  return (
    <>
      <PageHeader title="Tarefas" subtitle={isAdmin ? 'Todas as tarefas' : 'Tarefas atribuídas a você'}>
        {isAdmin && <button className="btn btn-primary" onClick={() => setNovo(true)}><Plus size={18} /> Nova tarefa</button>}
      </PageHeader>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Buscar por título…" />
        <select value={f.unidade_id} onChange={set('unidade_id')}><Options items={unidades.data} vazio="Todas as unidades" /></select>
        <select value={f.setor_id} onChange={set('setor_id')} disabled={!f.unidade_id}><Options items={setores.data} vazio="Todos os setores" /></select>
        {isAdmin && <select value={f.tecnico_id} onChange={set('tecnico_id')}><Options items={tecnicos.data} vazio="Todos os técnicos" /></select>}
        <select value={f.status} onChange={set('status')}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_TAREFA).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={f.prioridade} onChange={set('prioridade')}>
          <option value="">Todas as prioridades</option>
          {Object.entries(PRIORIDADE).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={f.campo} onChange={set('campo')} aria-label="Período por">
          <option value="criacao">Período: criação</option><option value="prazo">Período: prazo</option>
        </select>
        <input type="date" value={f.de} onChange={set('de')} aria-label="De" />
        <input type="date" value={f.ate} onChange={set('ate')} aria-label="Até" />
      </div>
      <ErrorMsg>{error}</ErrorMsg>
      {loading && !data ? <Loading /> : <TarefasTabela tarefas={data} mostrarTecnico={isAdmin} />}
      {novo && <TarefaForm onClose={() => setNovo(false)} onSaved={(t) => nav(`/tarefas/${t.id}`)} />}
    </>
  );
}
