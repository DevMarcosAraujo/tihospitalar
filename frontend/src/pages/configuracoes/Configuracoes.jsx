import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../../api/client';
import { useApi } from '../../api/useApi';
import { Badge, ErrorMsg, Field, Loading, Options, PageHeader } from '../../components/ui';

function AlterarSenha() {
  const [f, setF] = useState({ senha_atual: '', nova_senha: '', confirmar: '' });
  const [msg, setMsg] = useState({ tipo: '', texto: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function salvar(e) {
    e.preventDefault();
    if (f.nova_senha !== f.confirmar) return setMsg({ tipo: 'erro', texto: 'A confirmação não confere com a nova senha' });
    try {
      await api('/configuracoes/senha', { method: 'PUT', body: { senha_atual: f.senha_atual, nova_senha: f.nova_senha } });
      setF({ senha_atual: '', nova_senha: '', confirmar: '' });
      setMsg({ tipo: 'ok', texto: 'Senha alterada com sucesso' });
    } catch (err) { setMsg({ tipo: 'erro', texto: err.message }); }
  }

  return (
    <section className="card">
      <h2>Alterar minha senha</h2>
      {msg.texto && <div className={`alert ${msg.tipo === 'ok' ? 'alert-ok' : 'alert-error'}`}>{msg.texto}</div>}
      <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: '.9rem' }}>
        <Field label="Senha atual" required><input type="password" value={f.senha_atual} onChange={set('senha_atual')} required autoComplete="current-password" /></Field>
        <Field label="Nova senha" required hint="Mínimo de 6 caracteres"><input type="password" value={f.nova_senha} onChange={set('nova_senha')} required minLength={6} autoComplete="new-password" /></Field>
        <Field label="Confirmar nova senha" required><input type="password" value={f.confirmar} onChange={set('confirmar')} required autoComplete="new-password" /></Field>
        <div><button className="btn btn-primary">Alterar senha</button></div>
      </form>
    </section>
  );
}

function TiposEquipamento() {
  const tipos = useApi('/configuracoes/tipos');
  const categorias = useApi('/equipamentos/categorias');
  const [novo, setNovo] = useState({ categoria_id: '', nome: '' });
  const [erro, setErro] = useState('');

  async function adicionar(e) {
    e.preventDefault();
    setErro('');
    try { await api('/configuracoes/tipos', { method: 'POST', body: novo }); setNovo({ ...novo, nome: '' }); tipos.reload(); }
    catch (err) { setErro(err.message); }
  }
  async function alternar(t) {
    setErro('');
    try { await api(`/configuracoes/tipos/${t.id}/ativo`, { method: 'PATCH', body: { ativo: !t.ativo } }); tipos.reload(); }
    catch (err) { setErro(err.message); }
  }

  const porCategoria = {};
  (tipos.data || []).forEach((t) => { (porCategoria[t.categoria] ||= []).push(t); });

  return (
    <section className="card">
      <h2>Tipos de equipamento</h2>
      <ErrorMsg>{erro || tipos.error}</ErrorMsg>
      <form onSubmit={adicionar} className="toolbar">
        <select value={novo.categoria_id} onChange={(e) => setNovo({ ...novo, categoria_id: e.target.value })} required>
          <Options items={categorias.data} vazio="Categoria…" />
        </select>
        <input style={{ flex: 1, minWidth: 160 }} value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Novo tipo" required />
        <button className="btn btn-primary"><Plus size={18} /> Adicionar</button>
      </form>
      {tipos.loading && !tipos.data ? <Loading /> : Object.entries(porCategoria).map(([cat, lista]) => (
        <div key={cat} style={{ marginBottom: '1rem' }}>
          <h3>{cat}</h3>
          <div className="chips">
            {lista.map((t) => (
              <button key={t.id} className="btn btn-sm" onClick={() => alternar(t)} title={t.ativo ? 'Clique para inativar' : 'Clique para reativar'}
                style={{ opacity: t.ativo ? 1 : 0.5, textDecoration: t.ativo ? 'none' : 'line-through' }}>
                {t.nome} {!t.ativo && <Badge map={{ x: ['Inativo', 'gray'] }} value="x" />}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

export default function Configuracoes() {
  return (
    <>
      <PageHeader title="Configurações" />
      <div className="split">
        <AlterarSenha />
        <TiposEquipamento />
      </div>
    </>
  );
}
