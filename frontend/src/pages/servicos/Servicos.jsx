import { useState } from 'react';
import { CheckCircle2, Pencil, Play, Plus, Send, ThumbsDown, ThumbsUp, Trash2, Undo2, UserRoundCog } from 'lucide-react';
import { api } from '../../api/client';
import { useApi } from '../../api/useApi';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Empty, ErrorMsg, Field, FormActions, Loading, Modal, Options, PageHeader } from '../../components/ui';
import { PRIORIDADE, fmtDate, fmtDateTime } from '../../utils/format';

const STATUS = {
  PENDENTE: ['Pendente', 'blue'], EM_ANDAMENTO: ['Em andamento', 'amber'],
  AGUARDANDO_APROVACAO: ['Aguardando aprovação', 'amber'], DEVOLVIDO: ['Pendente: passar a outro técnico', 'red'], CONCLUIDO: ['Concluído', 'green'],
};
const ABAS = [['', 'Todos'], ['PENDENTE', 'Pendentes'], ['EM_ANDAMENTO', 'Em andamento'], ['AGUARDANDO_APROVACAO', 'Aguardando aprovação'], ['DEVOLVIDO', 'Pendentes p/ reatribuir'], ['CONCLUIDO', 'Concluídos']];

// Admin: cria/edita o serviço e escolhe o técnico
function ServicoForm({ servico, onClose, onSaved }) {
  const tecnicos = useApi('/usuarios', { perfil: 'TECNICO' });
  const [f, setF] = useState({
    titulo: servico?.titulo || '', descricao: servico?.descricao || '', tecnico_id: servico?.status === 'DEVOLVIDO' ? '' : (servico?.tecnico_id || ''),
    setor_id: servico?.setor_id || '', prioridade: servico?.prioridade || 'NORMAL', prazo: servico?.prazo ? String(servico.prazo).slice(0, 10) : '',
  });
  const unidadeDoTecnico = (tecnicos.data || []).find((t) => String(t.id) === String(f.tecnico_id))?.unidade_id;
  const setores = useApi(unidadeDoTecnico ? '/setores' : null, { unidade_id: unidadeDoTecnico });
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function salvar(e) {
    e.preventDefault();
    setSaving(true); setErro('');
    try {
      await api(servico ? `/servicos/${servico.id}` : '/servicos', { method: servico ? 'PUT' : 'POST', body: f });
      onSaved();
    } catch (err) { setErro(err.message); setSaving(false); }
  }

  return (
    <Modal title={servico?.status === 'DEVOLVIDO' ? 'Atribuir a outro técnico' : servico ? 'Editar serviço' : 'Novo serviço'} onClose={onClose}>
      <form onSubmit={salvar}>
        <ErrorMsg>{erro}</ErrorMsg>
        <div className="form-grid">
          <Field label="Serviço" required className="full"><input value={f.titulo} onChange={set('titulo')} required maxLength={160} placeholder="Ex.: Trocar o PC da recepção" autoFocus /></Field>
          <Field label="Descrição" className="full"><textarea rows={3} value={f.descricao} onChange={set('descricao')} placeholder="Detalhes do que precisa ser feito" /></Field>
          <Field label="Técnico responsável" required className="lado">
            <select value={f.tecnico_id} onChange={(e) => setF({ ...f, tecnico_id: e.target.value, setor_id: '' })} required>
              <option value="">Selecione…</option>
              {(tecnicos.data || []).map((t) => <option key={t.id} value={t.id}>{t.nome}{t.unidade_nome ? ` — ${t.unidade_nome}` : ''}</option>)}
            </select>
          </Field>
          <Field label="Setor (opcional)" className="lado">
            <select value={f.setor_id} onChange={set('setor_id')} disabled={!unidadeDoTecnico}>
              <Options items={setores.data} vazio="Nenhum" />
            </select>
          </Field>
          <Field label="Prioridade" className="lado">
            <select value={f.prioridade} onChange={set('prioridade')}>
              {Object.entries(PRIORIDADE).map(([k, [nome]]) => <option key={k} value={k}>{nome}</option>)}
            </select>
          </Field>
          <Field label="Prazo (opcional)" className="lado"><input type="date" value={f.prazo} onChange={set('prazo')} /></Field>
        </div>
        <FormActions onCancel={onClose} saving={saving} label={servico?.status === 'DEVOLVIDO' ? 'Atribuir' : servico ? 'Salvar' : 'Atribuir serviço'} />
      </form>
    </Modal>
  );
}

// Técnico: termina e informa o tipo do serviço; só vira "Concluído" depois que o admin aprovar
function EnviarForm({ servico, onClose, onSaved }) {
  const tipos = useApi('/servicos/tipos');
  const [tipo, setTipo] = useState('');
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setSaving(true); setErro('');
    try { await api(`/servicos/${servico.id}/enviar`, { method: 'POST', body: { tipo_servico: tipo, observacao: obs } }); onSaved(); }
    catch (err) { setErro(err.message); setSaving(false); }
  }

  return (
    <Modal title="Enviar para aprovação" onClose={onClose}>
      <form onSubmit={enviar}>
        <ErrorMsg>{erro}</ErrorMsg>
        <p className="muted" style={{ marginTop: 0 }}><strong>{servico.titulo}</strong></p>
        <div className="form-grid">
          <Field label="Tipo de serviço realizado" required className="full">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} required autoFocus>
              <option value="">Selecione…</option>
              {(tipos.data || []).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="O que foi feito" className="full" hint="Opcional, mas ajuda o administrador a aprovar."><textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} /></Field>
        </div>
        <p className="muted">O serviço só será concluído depois da aprovação do administrador.</p>
        <FormActions onCancel={onClose} saving={saving} disabled={!tipo} label="Enviar para aprovação" />
      </form>
    </Modal>
  );
}

// Técnico não consegue fazer: deixa pendente para o administrador atribuir ao próximo técnico
function DevolverForm({ servico, onClose, onSaved }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);

  async function devolver(e) {
    e.preventDefault();
    setSaving(true); setErro('');
    try { await api(`/servicos/${servico.id}/devolver`, { method: 'POST', body: { motivo } }); onSaved(); }
    catch (err) { setErro(err.message); setSaving(false); }
  }

  return (
    <Modal title="Deixar como pendente" onClose={onClose}>
      <form onSubmit={devolver}>
        <ErrorMsg>{erro}</ErrorMsg>
        <p className="muted" style={{ marginTop: 0 }}><strong>{servico.titulo}</strong> volta para o administrador atribuir ao próximo técnico.</p>
        <Field label="Motivo / o que já foi feito" required><textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} required autoFocus placeholder="Ex.: falta peça; já formatei, falta instalar os programas" /></Field>
        <FormActions onCancel={onClose} saving={saving} disabled={!motivo.trim()} label="Deixar pendente" />
      </form>
    </Modal>
  );
}

function ReprovarForm({ servico, onClose, onSaved }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);

  async function reprovar(e) {
    e.preventDefault();
    setSaving(true); setErro('');
    try { await api(`/servicos/${servico.id}/reprovar`, { method: 'POST', body: { motivo } }); onSaved(); }
    catch (err) { setErro(err.message); setSaving(false); }
  }

  return (
    <Modal title="Reprovar serviço" onClose={onClose}>
      <form onSubmit={reprovar}>
        <ErrorMsg>{erro}</ErrorMsg>
        <p className="muted" style={{ marginTop: 0 }}><strong>{servico.titulo}</strong> volta para o técnico {servico.tecnico_nome}.</p>
        <Field label="Motivo" required><textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} required autoFocus placeholder="O que precisa ser refeito" /></Field>
        <FormActions onCancel={onClose} saving={saving} disabled={!motivo.trim()} label="Reprovar e devolver" />
      </form>
    </Modal>
  );
}

export default function Servicos() {
  const { isAdmin, unidadeId } = useAuth();
  const [aba, setAba] = useState('');
  const [tecnicoId, setTecnicoId] = useState('');
  const [modal, setModal] = useState(null);
  const [erro, setErro] = useState('');
  const tecnicos = useApi(isAdmin ? '/usuarios' : null, { perfil: 'TECNICO' });
  const todos = useApi('/servicos', { tecnico_id: tecnicoId, unidade_id: isAdmin ? unidadeId : '' });
  const reloadTudo = () => { todos.reload(); };

  const lista = (todos.data || []).filter((s) => !aba || s.status === aba);
  const conta = (st) => (todos.data || []).filter((s) => !st || s.status === st).length;

  async function acao(s, rota, confirmar) {
    if (confirmar && !window.confirm(confirmar)) return;
    setErro('');
    try { await api(`/servicos/${s.id}/${rota}`, { method: 'POST' }); reloadTudo(); }
    catch (err) { setErro(err.message); }
  }
  async function excluir(s) {
    if (!window.confirm(`Excluir o serviço "${s.titulo}"?`)) return;
    setErro('');
    try { await api(`/servicos/${s.id}`, { method: 'DELETE' }); reloadTudo(); }
    catch (err) { setErro(err.message); }
  }
  const salvo = () => { setModal(null); reloadTudo(); };

  return (
    <>
      <PageHeader title="Serviços" subtitle={isAdmin ? 'Atribua serviços aos técnicos e aprove o que foi feito' : 'Serviços atribuídos a você'}>
        {isAdmin && <button className="btn btn-primary" onClick={() => setModal({ tipo: 'form' })}><Plus size={18} /> Novo serviço</button>}
      </PageHeader>

      <div className="tabs">
        {ABAS.map(([id, nome]) => (
          <button key={id} className={`tab ${aba === id ? 'ativa' : ''}`} onClick={() => setAba(id)}>{nome} ({conta(id)})</button>
        ))}
      </div>
      {isAdmin && (
        <div className="toolbar">
          <select value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)}><Options items={tecnicos.data} vazio="Todos os técnicos" /></select>
        </div>
      )}

      <ErrorMsg>{erro || todos.error}</ErrorMsg>
      {todos.loading && !todos.data ? <Loading /> : !lista.length ? <Empty>Nenhum serviço {aba ? 'nesta situação' : 'por aqui'}.</Empty> : (
        <div className="servicos-lista">
          {lista.map((s) => (
            <div key={s.id} className={`card servico st-${s.status} ${s.atrasado ? 'atrasado' : ''}`}>
              <div className="servico-topo">
                <div>
                  <h3>{s.titulo}</h3>
                  {s.descricao && <div className="muted">{s.descricao}</div>}
                </div>
                <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                  <Badge map={PRIORIDADE} value={s.prioridade} />
                  <Badge map={STATUS} value={s.status} />
                </div>
              </div>
              <div className="servico-meta">
                {isAdmin && <span className="chip">{s.tecnico_nome}</span>}
                {s.unidade_nome && <span className="chip">{s.unidade_nome}</span>}
                {s.setor_nome && <span className="chip">{s.setor_nome}</span>}
                {s.prazo && <span className={`chip ${s.atrasado ? 'atrasado' : ''}`}>Prazo: {fmtDate(String(s.prazo).slice(0, 10))}{s.atrasado ? ' (atrasado)' : ''}</span>}
                {s.tipo_servico && <span className="chip">Tipo: {s.tipo_servico}</span>}
              </div>

              {s.motivo_reprovacao && s.status === 'EM_ANDAMENTO' && (
                <div className="servico-aviso"><strong>Reprovado:</strong> {s.motivo_reprovacao}. Refaça e envie de novo.</div>
              )}
              {s.status === 'DEVOLVIDO' && (
                <div className="servico-aviso"><strong>{s.tecnico_nome}</strong> deixou pendente: {s.motivo_devolucao}{isAdmin ? ' Atribua a outro técnico.' : ' Aguardando o administrador passar para outro técnico.'}</div>
              )}
              {s.status === 'AGUARDANDO_APROVACAO' && (
                <div className="servico-aviso">
                  Enviado em {fmtDateTime(s.enviado_em)} · <strong>{s.tipo_servico}</strong>
                  {s.observacao_tecnico && <> · {s.observacao_tecnico}</>}
                </div>
              )}
              {s.status === 'CONCLUIDO' && (
                <div className="servico-aviso ok"><CheckCircle2 size={15} style={{ verticalAlign: '-3px' }} /> Aprovado por {s.aprovado_por_nome || '—'} em {fmtDateTime(s.aprovado_em)}</div>
              )}

              <div className="servico-acoes">
                {!isAdmin && s.status === 'PENDENTE' && <button className="btn btn-sm" onClick={() => acao(s, 'iniciar')}><Play size={15} /> Iniciar</button>}
                {!isAdmin && ['PENDENTE', 'EM_ANDAMENTO'].includes(s.status) && (
                  <button className="btn btn-sm" onClick={() => setModal({ tipo: 'devolver', servico: s })}><Undo2 size={15} /> Deixar pendente</button>
                )}
                {isAdmin && s.status === 'DEVOLVIDO' && (
                  <button className="btn btn-sm btn-primary" onClick={() => setModal({ tipo: 'form', servico: s })}><UserRoundCog size={15} /> Atribuir a outro técnico</button>
                )}
                {!isAdmin && ['PENDENTE', 'EM_ANDAMENTO'].includes(s.status) && (
                  <button className="btn btn-sm btn-primary" onClick={() => setModal({ tipo: 'enviar', servico: s })}><Send size={15} /> Enviar para aprovação</button>
                )}
                {isAdmin && s.status === 'AGUARDANDO_APROVACAO' && (
                  <>
                    <button className="btn btn-sm btn-primary" onClick={() => acao(s, 'aprovar', `Aprovar e concluir "${s.titulo}"?`)}><ThumbsUp size={15} /> Aprovar</button>
                    <button className="btn btn-sm" onClick={() => setModal({ tipo: 'reprovar', servico: s })}><ThumbsDown size={15} /> Reprovar</button>
                  </>
                )}
                {isAdmin && s.status !== 'CONCLUIDO' && (
                  <button className="icon-btn" title="Editar" onClick={() => setModal({ tipo: 'form', servico: s })}><Pencil size={17} /></button>
                )}
                {isAdmin && (
                  <button className="icon-btn" title="Excluir" onClick={() => excluir(s)}><Trash2 size={17} color="var(--red)" /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdmin && <button className="fab" onClick={() => setModal({ tipo: 'form' })} aria-label="Novo serviço"><Plus size={26} /></button>}
      {modal?.tipo === 'form' && <ServicoForm servico={modal.servico} onClose={() => setModal(null)} onSaved={salvo} />}
      {modal?.tipo === 'enviar' && <EnviarForm servico={modal.servico} onClose={() => setModal(null)} onSaved={salvo} />}
      {modal?.tipo === 'devolver' && <DevolverForm servico={modal.servico} onClose={() => setModal(null)} onSaved={salvo} />}
      {modal?.tipo === 'reprovar' && <ReprovarForm servico={modal.servico} onClose={() => setModal(null)} onSaved={salvo} />}
    </>
  );
}
