import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { useApi } from '../../api/useApi';
import { ErrorMsg, Field, FormActions, Modal, Options } from '../../components/ui';
import { PRIORIDADE } from '../../utils/format';

// Criação (tarefa = null) e edição de tarefa — somente administrador
export default function TarefaForm({ tarefa, onClose, onSaved }) {
  const [f, setF] = useState({
    titulo: tarefa?.titulo || '', descricao: tarefa?.descricao || '',
    unidade_id: tarefa?.unidade_id || '', setor_id: tarefa?.setor_id || '', tecnico_id: tarefa?.tecnico_id || '',
    prazo: tarefa?.prazo || '', prioridade: tarefa?.prioridade || 'NORMAL',
  });
  const [atividades, setAtividades] = useState(
    tarefa?.atividades?.map((a) => ({ id: a.id, descricao: a.descricao, travada: a.concluida })) || [{ descricao: '' }]
  );
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);

  const unidades = useApi('/unidades');
  const setores = useApi(f.unidade_id ? '/setores' : null, { unidade_id: f.unidade_id });
  const tecnicos = useApi('/usuarios', { perfil: 'TECNICO' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setAtiv = (i, v) => setAtividades(atividades.map((a, j) => (j === i ? { ...a, descricao: v } : a)));

  async function salvar(e) {
    e.preventDefault();
    setSaving(true); setErro('');
    try {
      const body = { ...f, atividades: atividades.map(({ id, descricao }) => ({ id, descricao })) };
      const r = await api(tarefa ? `/tarefas/${tarefa.id}` : '/tarefas', { method: tarefa ? 'PUT' : 'POST', body });
      onSaved(r);
    } catch (err) { setErro(err.message); setSaving(false); }
  }

  return (
    <Modal title={tarefa ? 'Editar tarefa' : 'Nova tarefa'} onClose={onClose} wide>
      <form onSubmit={salvar}>
        <ErrorMsg>{erro}</ErrorMsg>
        <div className="form-corpo">
          <div className="form-grid">
            <Field label="Título" required className="full"><input value={f.titulo} onChange={set('titulo')} required autoFocus={!tarefa} /></Field>
            <Field label="Descrição" className="full"><textarea value={f.descricao} onChange={set('descricao')} /></Field>
          </div>

          <section className="passo bloco">
            <h3>Onde e quem</h3>
            <div className="form-grid">
              <Field label="Unidade" required className="lado">
                <select value={f.unidade_id} onChange={(e) => setF({ ...f, unidade_id: e.target.value, setor_id: '' })} required>
                  <Options items={unidades.data} vazio="Selecione…" />
                </select>
              </Field>
              <Field label="Setor" required className="lado">
                <select value={f.setor_id} onChange={set('setor_id')} required disabled={!f.unidade_id}>
                  <Options items={setores.data} vazio={f.unidade_id ? 'Selecione…' : 'Escolha a unidade primeiro'} />
                </select>
              </Field>
              <Field label="Técnico responsável" required className="full">
                <select value={f.tecnico_id} onChange={set('tecnico_id')} required><Options items={tecnicos.data} vazio="Selecione…" /></select>
              </Field>
            </div>
          </section>

          <section className="passo bloco">
            <h3>Prazo e prioridade</h3>
            <div className="form-grid">
              <Field label="Prazo" required><input type="date" value={f.prazo} onChange={set('prazo')} required /></Field>
              <Field label="Prioridade" required>
                <select value={f.prioridade} onChange={set('prioridade')}>
                  {Object.entries(PRIORIDADE).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </Field>
            </div>
          </section>

          <section className="passo bloco">
            <h3>Atividades <b className="req">*</b> <span className="muted contador">({atividades.filter((a) => a.descricao.trim()).length})</span></h3>
            <div className="lista-ativ">
              {atividades.map((a, i) => (
                <div className="ativ-linha" key={a.id || `n${i}`}>
                  <input value={a.descricao} onChange={(e) => setAtiv(i, e.target.value)} placeholder={`Atividade ${i + 1}`} aria-label={`Atividade ${i + 1}`} />
                  <button type="button" className="btn" disabled={a.travada || atividades.length === 1}
                    title={a.travada ? 'Atividade já executada' : 'Remover'} aria-label="Remover atividade" onClick={() => setAtividades(atividades.filter((_, j) => j !== i))}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-sm mt" onClick={() => setAtividades([...atividades, { descricao: '' }])}>
              <Plus size={16} /> Adicionar atividade
            </button>
          </section>
        </div>
        <FormActions onCancel={onClose} saving={saving} label={tarefa ? 'Salvar alterações' : 'Criar tarefa'} />
      </form>
    </Modal>
  );
}
