import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../api/client';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  // Unidade escolhida pelo administrador no menu ('' = todas). O técnico é limitado à própria unidade pelo backend.
  const [unidadeAtiva, setUnidadeAtivaState] = useState(() => { try { return localStorage.getItem('ti_unidade') || ''; } catch { return ''; } });
  const setUnidadeAtiva = (id) => {
    setUnidadeAtivaState(id);
    try { localStorage.setItem('ti_unidade', id); } catch { /* sem storage */ }
  };
  const [recursos, setRecursos] = useState({ mapeamento_tecnicos: false });

  useEffect(() => {
    const expirou = () => setUser(null);
    window.addEventListener('auth:expired', expirou);
    if (!getToken()) setReady(true);
    else {
      api('/auth/me')
        .then((r) => setUser(r.usuario))
        .catch(() => setToken(null))
        .finally(() => setReady(true));
    }
    return () => window.removeEventListener('auth:expired', expirou);
  }, []);

  // Recursos que o administrador libera para os técnicos
  useEffect(() => {
    if (user) api('/recursos').then(setRecursos).catch(() => {});
  }, [user]);
  const liberarMapeamento = (liberado) => api('/recursos/mapeamento', { method: 'PUT', body: { liberado } }).then(setRecursos);

  // Troca de senha (obrigatória no primeiro acesso)
  async function trocarSenha(senhaAtual, novaSenha) {
    await api('/auth/trocar-senha', { method: 'POST', body: { senha_atual: senhaAtual, nova_senha: novaSenha } });
    setUser((u) => ({ ...u, trocar_senha: false }));
  }

  async function login(usuario, senha) {
    const r = await api('/auth/login', { method: 'POST', body: { usuario, senha } });
    setToken(r.token);
    setUser(r.usuario);
  }
  const logout = () => { setToken(null); setUser(null); };

  return (
    <AuthCtx.Provider value={{ user, ready, login, logout, unidadeId: user?.perfil === 'ADMINISTRADOR' ? unidadeAtiva : '', setUnidadeAtiva, trocarSenha, recursos, liberarMapeamento, isAdmin: user?.perfil === 'ADMINISTRADOR' }}>
      {children}
    </AuthCtx.Provider>
  );
}
