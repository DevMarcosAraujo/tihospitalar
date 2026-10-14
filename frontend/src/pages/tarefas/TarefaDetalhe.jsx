import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Check, Pencil } from 'lucide-react';
import { api } from '../../api/client';
import { useApi } from '../../api/useApi';
import { useAuth } from '../../auth/AuthContext';
import { Badge, ErrorMsg, Field, Loading, Modal, PageHeader, Progress } from '../../components/ui';
import { PRIORIDADE, RESULTADO, STATUS_TAREFA, fmtDate, fmtDateTime, rotulo } from '../../utils/format';
import TarefaForm from './TarefaForm';

const OPCOES = [['OK', 'OK'], ['PROBLEMA_ENCONTRADO', 'Problema encontrado'], ['NAO_APLICAVEL', 'Não aplicável']];

// Formulário de execução: poucos cliques, botões grandes (uso em tablet)
function ExecutarModal({ tarefaId, atividade, onClose, onDone }) {
  const [resultado, setResultado] = useState('');
  const [observacao, setObservacao] = useState('');
  const [problema, setProblema] = useState('');
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    if (!resultado) return setErro('Escolha o resultado');
    setSaving(true); setErro('');
    try {
      await api(`/tarefas/${tarefaId}/atividades/${atividade.id}/executar`, { method: 'POST', body: { resultado, observacao, problema } });
      onDone();
    } catch (err) { setErro(err.message); setSaving(false); }
  }

  return (
    <Modal title={atividade.descricao} onClose={onClose}>
      <form onSubmit={salvar}>
        <ErrorMsg>{erro}</ErrorMsg>
        <div className="opcoes-resultado">
          {OPCOES.map(([v, l]) => (
            <button type="button" key={v} className={`opcao ${resultado === v ? `sel-${v}` : ''}`} onClick={() => setResultado(v)}>{l}</button>
          ))}
        </div>
        {resultado === 'PROBLEMA_ENCONTRADO' && (
          <Field label="Descrição do problema" required className="mt">
            <textarea value={problema} onChange={(e) => setProblema(e.target.value)} required autoFocus placeholder="Ex.: Impressora Zebra não está imprimindo etiquetas." />
          </Field>
        )}
        <Field label="Observação" className="mt"><textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} /></Field>
        <p className="muted mt">Data e hora são registradas automaticamente.</p>
        <div className="form-actions">
          <button type="button" className="btn btn-lg" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary btn-lg" disabled={saving}>{saving ? 'Salvando…' : 'Concluir atividade'}</button>
        </div>
      </form>
    </Modal>
  );
}

function descreverEvento(h) {
  const d = h.detalhe || {};
  switch (h.evento) {
    case 'CRIACAO': return 'Tarefa criada';
    case 'EDICAO': return 'Tarefa editada';
    case 'TROCA_TECNICO': return 'Técnico responsável alterado';
    case 'ALTERACAO_PRAZO': return `Prazo alterado de ${fmtDate(d.de)} para ${fmtDate(d.para)}`;
    case 'MUDANCA_STATUS': return `Status: ${rotulo(STATUS_TAREFA, d.de)} → ${rotulo(STATUS_TAREFA, d.para)}`;
    case 'ATIVIDADE_EXECUTADA': return `${d.atividade} — ${rotulo(RESULTADO, d.resultado)}`;
    default: return h.evento;
  }
}

export default function TarefaDetalhe() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const { data: t, loading, error, reload } = useApi(`/tarefas/${id}`);
  const [executando, setExecutando] = useState(null);
  const [editando, setEditando] = useState(false);

  if (loading && !t) return <Loading />;
  if (error) return <ErrorMsg>{error}</ErrorMsg>;

  return (
    <>
      <PageHeader title={t.titulo} subtitle={`${t.unidade_nome} · ${t.setor_nome}`} back="/tarefas">
        {isAdmin && <button className="btn" onClick={() => setEditando(true)}><Pencil size={17} /> Editar tarefa</button>}
      </PageHeader>

      <div className="card">
        <dl className="info-grid">
          <div><dt>Status</dt><dd><Badge map={STATUS_TAREFA} value={t.status} /></dd></div>
          <div><dt>Prioridade</dt><dd><Badge map={PRIORIDADE} value={t.prioridade} /></dd></div>
          <div><dt>Técnico</dt><dd>{t.tecnico_nome}</dd></div>
          <div><dt>Criada em</dt><dd>{fmtDate(t.criado_em)}</dd></div>
          <div><dt>Prazo</dt><dd>{fmtDate(t.prazo)}</dd></div>
          <div><dt>Progresso</dt><dd><Progress feitas={t.concluidas} total={t.total} /></dd></div>
        </dl>
        {t.descricao && <p style={{ marginBottom: 0 }}>{t.descricao}</p>}
        {t.problemas > 0 && (
          <div className="alert alert-error" style={{ margin: '1rem 0 0' }}>
            <AlertTriangle size={16} style={{ verticalAlign: '-3px' }} /> {t.problemas} {t.problemas === 1 ? 'problema encontrado' : 'problemas encontrados'} nesta tarefa
          </div>
        )}
      </div>

      <div className="split mt">
        <section className="card">
          <h2>Atividades</h2>
          {t.atividades.map((a) => {
            const podeExecutar = !isAdmin && !a.concluida;
            return (
              <div className="atividade" key={a.id}>
                <button type="button"
                  className={`check-grande ${a.concluida ? (a.resultado === 'PROBLEMA_ENCONTRADO' ? 'feito problema' : 'feito') : ''}`}
                  disabled={!podeExecutar} onClick={() => setExecutando(a)}
                  aria-label={a.concluida ? 'Atividade concluída' : 'Concluir atividade'}>
                  {a.concluida && <Check size={26} />}
                </button>
                <div className="corpo">
                  <strong>{a.descricao}</strong>
                  {a.concluida && (
                    <>
                      <div><Badge map={RESULTADO} value={a.resultado} /> <span className="muted">{a.executado_por_nome} · {fmtDateTime(a.executado_em)}</span></div>
                      {a.problema && <div className="nota problema">Problema: {a.problema}</div>}
                      {a.observacao && <div className="nota">Obs.: {a.observacao}</div>}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        <section className="card">
          <h2>Histórico</h2>
          <ul className="historico">
            {t.historico.map((h) => (
              <li key={h.id} className={h.detalhe?.resultado === 'PROBLEMA_ENCONTRADO' ? 'problema' : ''}>
                <strong>{descreverEvento(h)}</strong>
                {h.detalhe?.problema && <div style={{ color: 'var(--red)' }}>Problema: {h.detalhe.problema}</div>}
                {h.detalhe?.observacao && <div className="muted">Obs.: {h.detalhe.observacao}</div>}
                <small>{h.usuario_nome} · {fmtDateTime(h.criado_em)}</small>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {executando && <ExecutarModal tarefaId={t.id} atividade={executando} onClose={() => setExecutando(null)} onDone={() => { setExecutando(null); reload(); }} />}
      {editando && <TarefaForm tarefa={t} onClose={() => setEditando(false)} onSaved={() => { setEditando(false); reload(); }} />}
    </>
  );
}
