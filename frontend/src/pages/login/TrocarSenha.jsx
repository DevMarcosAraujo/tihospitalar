import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { ErrorMsg, Field } from '../../components/ui';

// Tela obrigatória no primeiro acesso (ou após o administrador redefinir a senha)
export default function TrocarSenha() {
  const { user, trocarSenha, logout } = useAuth();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    if (nova !== confirma) { setErro('A confirmação não confere com a nova senha'); return; }
    setEnviando(true);
    try { await trocarSenha(atual, nova); }
    catch (err) { setErro(err.message); setEnviando(false); }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Crie sua senha</h1>
        <p className="muted">Olá, {user.nome.split(' ')[0]}. Por segurança, troque a senha provisória antes de continuar.</p>
        <form onSubmit={enviar}>
          <ErrorMsg>{erro}</ErrorMsg>
          <Field label="Senha atual (provisória)">
            <input type="password" value={atual} onChange={(e) => setAtual(e.target.value)} autoComplete="current-password" required autoFocus />
          </Field>
          <Field label="Nova senha" hint="Mínimo de 6 caracteres">
            <input type="password" value={nova} onChange={(e) => setNova(e.target.value)} autoComplete="new-password" minLength={6} required />
          </Field>
          <Field label="Repita a nova senha">
            <input type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)} autoComplete="new-password" minLength={6} required />
          </Field>
          <button className="btn btn-primary btn-lg" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar nova senha'}</button>
          <button type="button" className="btn" onClick={logout} style={{ marginTop: '.5rem' }}>Sair</button>
        </form>
      </div>
    </div>
  );
}
