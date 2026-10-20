import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ErrorMsg, Field } from '../../components/ui';

export default function Login() {
  const { login } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try { await login(usuario.trim(), senha); }
    catch (err) { setErro(err.message); setEnviando(false); }
  }

  return (
    <div className="login-page">
      <div className="login-fundo" aria-hidden="true">
        <span className="orb o1" /><span className="orb o2" /><span className="orb o3" />
        <span className="login-grade" />
        <span className="login-ti">TI</span>
      </div>
      <div className="login-card">
        <img src="/logo.svg" alt="TI" className="login-logo" />
        <h1>Mapeamento de TI</h1>
        <p className="muted">MedSênior · SIG — Brasília/DF</p>
        <form onSubmit={entrar}>
          <ErrorMsg>{erro}</ErrorMsg>
          <Field label="Usuário">
            <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoFocus autoComplete="username"
              autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
          </Field>
          <Field label="Senha">
            <div className="senha-wrap">
              <input type={verSenha ? 'text' : 'password'} value={senha} onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password" required />
              <button type="button" className="icon-btn" onClick={() => setVerSenha(!verSenha)}
                aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}>
                {verSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
          <button className="btn btn-primary btn-lg" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        </form>
        <p className="login-ajuda muted">Primeiro acesso? Use a senha provisória enviada pelo administrador.</p>
        <p className="login-creditos muted">Arquitetura: Rodrigo Souza · Engenheiro: Marcos Araujo</p>
      </div>
    </div>
  );
}
