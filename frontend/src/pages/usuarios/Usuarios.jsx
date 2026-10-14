import { useState } from 'react';
import { KeyRound, Pencil, Plus, Power } from 'lucide-react';
import { api } from '../../api/client';
import { useApi, useDebounced } from '../../api/useApi';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Empty, ErrorMsg, Field, FormActions, Loading, Modal, Options, PageHeader, SearchBox } from '../../components/ui';

const PERFIL = { ADMINISTRADOR: ['Administrador', 'blue'], TECNICO: ['Técnico', 'gray'] };
const ATIVO = { true: ['Ativo', 'green'], false: ['Inativo', 'gray'] };
const VAZIO = { nome: '', usuario: '', senha: '', email: '', telefone: '', perfil: 'TECNICO', unidade_id: '', ativo: true };

function UsuarioForm({ usuario, onClose, onSaved }) {
  const [f, setF] = useState(usuario ? { ...VAZIO, ...usuario, unidade_id: usuario.unidade_id || '', senha: '' } : VAZIO);
  const unidades = useApi('/unidades');
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function salvar(e) {
    e.preventDefault();
    setSaving(true); setErro('');
    try {
      await api(usuario ? `/usuarios/${usuario.id}` : '/usuarios', { method: usuario ? 'PUT' : 'POST', body: f });
      onSaved();
    } catch (err) { setErro(err.message); setSaving(false); }
  }

  return (
    <Modal title={usuario ? 'Editar usuário' : 'Novo usuário'} onClose={onClose}>
      <form onSubmit={salvar}>
        <ErrorMsg>{erro}</ErrorMsg>
        <div className="form-grid">
          <Field label="Nome" required className="full"><input value={f.nome} onChange={set('nome')} required /></Field>
          <Field label="Usuário" required><input value={f.usuario} onChange={set('usuario')} required autoComplete="off" autoCapitalize="none" /></Field>
          <Field label={usuario ? 'Nova senha provisória' : 'Senha provisória'} required={!usuario} hint={usuario ? 'Vazio = manter. Se preencher, o usuário troca no próximo acesso.' : 'Mín. 6 caracteres. O usuário troca no primeiro acesso.'}>
            <input type="password" value={f.senha} onChange={set('senha')} required={!usuario} minLength={f.senha ? 6 : undefined} autoComplete="new-password" />
          </Field>
          <Field label="E-mail" className="full"><input type="email" value={f.email || ''} onChange={set('email')} /></Field>
          <Field label="Telefone"><input value={f.telefone || ''} onChange={set('telefone')} inputMode="tel" /></Field>
          <Field label="Perfil" required>
            <select value={f.perfil} onChange={set('perfil')}><option value="TECNICO">Técnico</option><option value="ADMINISTRADOR">Administrador</option></select>
          </Field>
          {f.perfil === 'TECNICO' && (
            <Field label="Unidade do técnico" required className="full" hint="O técnico fica fixo nesta unidade. Para mudar, edite aqui.">
              <select value={f.unidade_id} onChange={set('unidade_id')} required>
                <Options items={unidades.data} vazio="Selecione…" />
              </select>
            </Field>
          )}
          <Field label="Status" className="full">
            <select value={String(f.ativo)} onChange={(e) => setF({ ...f, ativo: e.target.value === 'true' })}>
              <option value="true">Ativo</option><option value="false">Inativo</option>
            </select>
          </Field>
        </div>
        <FormActions onCancel={onClose} saving={saving} />
      </form>
    </Modal>
  );
}

export default function Usuarios() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [inativos, setInativos] = useState(false);
  const [modal, setModal] = useState(null);
  const [erro, setErro] = useState('');
  const [provisoria, setProvisoria] = useState(null);
  const busca = useDebounced(q);
  const { data, loading, error, reload } = useApi('/usuarios', { q: busca, inativos });

  async function alternar(u) {
    setErro('');
    try { await api(`/usuarios/${u.id}/ativo`, { method: 'PATCH', body: { ativo: !u.ativo } }); reload(); }
    catch (err) { setErro(err.message); }
  }

  async function redefinir(u) {
    if (!window.confirm(`Redefinir a senha de ${u.nome}? Será gerada uma senha provisória e ele precisará trocá-la no próximo acesso.`)) return;
    setErro('');
    try {
      const r = await api(`/usuarios/${u.id}/redefinir-senha`, { method: 'POST', body: {} });
      setProvisoria({ nome: u.nome, usuario: u.usuario, senha: r.senha_provisoria });
    } catch (err) { setErro(err.message); }
  }

  return (
    <>
      <PageHeader title="Usuários" subtitle="Administradores e técnicos">
        <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={18} /> Novo usuário</button>
      </PageHeader>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Buscar por nome ou usuário…" />
        <label className="check"><input type="checkbox" checked={inativos} onChange={(e) => setInativos(e.target.checked)} /> Mostrar inativos</label>
      </div>
      <ErrorMsg>{erro || error}</ErrorMsg>
      <div className="table-wrap">
        {loading && !data ? <Loading /> : !data?.length ? <Empty /> : (
          <table>
            <thead><tr><th>Nome</th><th>Usuário</th><th>Perfil</th><th>Unidade</th><th>E-mail</th><th>Telefone</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id} className={u.ativo ? '' : 'inativo'}>
                  <td><strong>{u.nome}</strong></td><td>{u.usuario}</td>
                  <td><Badge map={PERFIL} value={u.perfil} /></td>
                  <td>{u.perfil === 'TECNICO' ? (u.unidade_nome || <span className="badge badge-red">Sem unidade</span>) : '—'}</td>
                  <td>{u.email || '—'}</td><td>{u.telefone || '—'}</td>
                  <td><Badge map={ATIVO} value={String(u.ativo)} /></td>
                  <td className="acoes">
                    <button className="icon-btn" title="Editar" onClick={() => setModal(u)}><Pencil size={17} /></button>
                    <button className="icon-btn" title="Redefinir senha" disabled={u.id === user.id} onClick={() => redefinir(u)}><KeyRound size={17} /></button>
                    <button className="icon-btn" title={u.ativo ? 'Inativar' : 'Reativar'} disabled={u.id === user.id} onClick={() => alternar(u)}><Power size={17} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {provisoria && (
        <Modal title="Senha provisória" onClose={() => setProvisoria(null)}>
          <p>Informe a {provisoria.nome} (<strong>{provisoria.usuario}</strong>) a senha provisória abaixo. Ela só aparece agora; no próximo acesso o usuário será obrigado a criar uma nova senha.</p>
          <p style={{ fontFamily: 'monospace', fontSize: '1.6rem', fontWeight: 700, textAlign: 'center', letterSpacing: '.1em', margin: '1rem 0' }}>{provisoria.senha}</p>
          <div className="form-actions"><button className="btn btn-primary" onClick={() => setProvisoria(null)}>Fechar</button></div>
        </Modal>
      )}
      {modal && <UsuarioForm usuario={modal.id ? modal : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />}
    </>
  );
}
