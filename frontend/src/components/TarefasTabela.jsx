import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Badge, Empty, Progress } from './ui';
import { PRIORIDADE, STATUS_TAREFA, fmtDate } from '../utils/format';

// Tabela de tarefas com progresso; tarefas com problemas ficam destacadas
export default function TarefasTabela({ tarefas, mostrarTecnico }) {
  const nav = useNavigate();
  if (!tarefas?.length) return <div className="table-wrap"><Empty>Nenhuma tarefa encontrada.</Empty></div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Título</th><th>Unidade</th><th>Setor</th>
            {mostrarTecnico && <th>Técnico</th>}
            <th>Prazo</th><th>Prioridade</th><th>Status</th><th>Progresso</th>
          </tr>
        </thead>
        <tbody>
          {tarefas.map((t) => (
            <tr key={t.id} className={`clicavel ${t.problemas > 0 ? 'com-problema' : ''}`} onClick={() => nav(`/tarefas/${t.id}`)}>
              <td>
                <strong>{t.titulo}</strong>
                {t.problemas > 0 && (
                  <div><span className="badge badge-red"><AlertTriangle size={12} style={{ verticalAlign: '-2px' }} /> {t.problemas} {t.problemas === 1 ? 'problema' : 'problemas'}</span></div>
                )}
              </td>
              <td>{t.unidade_nome}</td>
              <td>{t.setor_nome}</td>
              {mostrarTecnico && <td>{t.tecnico_nome}</td>}
              <td>{fmtDate(t.prazo)}</td>
              <td><Badge map={PRIORIDADE} value={t.prioridade} /></td>
              <td><Badge map={STATUS_TAREFA} value={t.status} /></td>
              <td><Progress feitas={t.concluidas} total={t.total} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
