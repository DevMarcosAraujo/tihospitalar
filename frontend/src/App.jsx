import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import AppLayout from './layouts/AppLayout';
import Login from './pages/login/Login';
import TrocarSenha from './pages/login/TrocarSenha';
import Dashboard from './pages/dashboard/Dashboard';
import Unidades from './pages/unidades/Unidades';
import UnidadeDetalhe from './pages/unidades/UnidadeDetalhe';
import Setores from './pages/setores/Setores';
import SetorDetalhe from './pages/setores/SetorDetalhe';
import Mapeamento from './pages/mapeamento/Mapeamento';
import BeiraLeito from './pages/beira-leito/BeiraLeito';
import Usuarios from './pages/usuarios/Usuarios';
import Relatorios from './pages/relatorios/Relatorios';
import Configuracoes from './pages/configuracoes/Configuracoes';
import { Loading } from './components/ui';

function Protegida({ children, admin, recurso }) {
  const { user, ready, isAdmin, recursos } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && !isAdmin) return <Navigate to="/" replace />;
  if (recurso && !isAdmin && !recursos[recurso]) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (user?.trocar_senha) return <TrocarSenha />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<Protegida><AppLayout /></Protegida>}>
        <Route index element={<Dashboard />} />
        <Route path="unidades" element={<Unidades />} />
        <Route path="unidades/:id" element={<UnidadeDetalhe />} />
        <Route path="setores" element={<Setores />} />
        <Route path="setores/:id" element={<SetorDetalhe />} />
        <Route path="mapeamento" element={<Protegida recurso="mapeamento_tecnicos"><Mapeamento /></Protegida>} />
        <Route path="beira-leito/:divisao" element={<BeiraLeito />} />
        <Route path="equipamentos" element={<Navigate to="/setores" replace />} />
        <Route path="tarefas/*" element={<Navigate to="/" replace />} />
        <Route path="usuarios" element={<Protegida admin><Usuarios /></Protegida>} />
        <Route path="relatorios" element={<Protegida admin><Relatorios /></Protegida>} />
        <Route path="configuracoes" element={<Protegida admin><Configuracoes /></Protegida>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
