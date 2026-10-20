import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Building2, Download, Map as MapIcon, FileText, Layers, LayoutDashboard, LogOut, Menu,
  PanelLeftClose, PanelLeftOpen, Settings, Users, Wifi, X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../api/useApi';

// O menu mostra apenas o que o perfil pode acessar
const MENU = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/unidades', label: 'Unidades', icon: Building2 },
  { to: '/mapeamento', label: 'Mapeamento', icon: MapIcon, recurso: 'mapeamento_tecnicos' },
  { to: '/setores', label: 'Setores', icon: Layers },
  { to: '/access-points', label: 'Access Points', icon: Wifi },
  { to: '/usuarios', label: 'Usuários', icon: Users, admin: true },
  { to: '/exportar', label: 'Exportar', icon: Download, admin: true },
  { to: '/relatorios', label: 'Relatórios', icon: FileText, admin: true },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, admin: true },
];

const MOBILE = '(max-width: 768px)';

function useMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE).matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE);
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}

// No celular as tabelas viram cartões: cada célula recebe o rótulo da sua coluna (data-label)
function rotularTabelas(root) {
  root.querySelectorAll('table').forEach((t) => {
    const cab = [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    t.querySelectorAll('tbody tr').forEach((tr) => {
      [...tr.children].forEach((td, i) => {
        if (cab[i] !== undefined && td.getAttribute('data-label') !== cab[i]) td.setAttribute('data-label', cab[i]);
        // célula sem informação ('—'): o CSS esconde no celular
        if (td.textContent.trim() === '—') td.setAttribute('data-vazio', '1');
        else td.removeAttribute('data-vazio');
      });
    });
  });
}

const inicial = () => {
  try {
    const salvo = localStorage.getItem('ti_menu_recolhido');
    return salvo === null ? window.innerWidth < 1000 : salvo === '1';
  } catch { return false; }
};

export default function AppLayout() {
  const { user, logout, isAdmin, recursos, unidadeId, setUnidadeAtiva } = useAuth();
  const unidades = useApi(isAdmin ? '/unidades' : null);
  const nomeUnidade = isAdmin ? (unidades.data || []).find((u) => String(u.id) === String(unidadeId))?.nome || 'Todas as unidades' : user.unidade_nome;
  const mobile = useMobile();
  const [recolhido, setRecolhido] = useState(inicial);
  const [gaveta, setGaveta] = useState(false);
  const { pathname } = useLocation();
  const conteudo = useRef(null);

  const mini = recolhido && !mobile; // no celular o menu sempre mostra os textos
  const titulo = MENU.find((m) => (m.end ? pathname === m.to : pathname.startsWith(m.to)))?.label || 'Infra Hospitalar';

  useEffect(() => { try { localStorage.setItem('ti_menu_recolhido', recolhido ? '1' : '0'); } catch { /* sem storage */ } }, [recolhido]);
  useEffect(() => { window.scrollTo(0, 0); setGaveta(false); }, [pathname]);

  useEffect(() => {
    const el = conteudo.current;
    if (!el) return undefined;
    rotularTabelas(el);
    const obs = new MutationObserver(() => rotularTabelas(el));
    obs.observe(el, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  // Bloqueia a rolagem da página enquanto a gaveta está aberta
  useEffect(() => {
    document.body.style.overflow = gaveta ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [gaveta]);

  return (
    <div className={`shell ${mini ? 'collapsed' : ''} ${gaveta ? 'drawer-open' : ''}`}>
      <header className="topbar">
        <button className="icon-btn" onClick={() => setGaveta(true)} aria-label="Abrir menu"><Menu size={24} /></button>
        <strong>{titulo}</strong>
        {nomeUnidade && <small className="topbar-unidade">{nomeUnidade}</small>}
      </header>
      {gaveta && <div className="drawer-backdrop" onClick={() => setGaveta(false)} />}

      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.svg" alt="TI" className="menu-logo" />
          {!mini && <span className="brand-name">Infra Hospitalar</span>}
          {mobile && <button className="icon-btn drawer-close" onClick={() => setGaveta(false)} aria-label="Fechar menu"><X size={22} /></button>}
        </div>
        {isAdmin && !mini && (unidades.data || []).length > 0 && (
          <label className="unidade-seletor">
            <span>Unidade</span>
            <select value={unidadeId} onChange={(e) => setUnidadeAtiva(e.target.value)}>
              <option value="">Todas as unidades</option>
              {unidades.data.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </label>
        )}
        {!isAdmin && !mini && user.unidade_nome && (
          <div className="unidade-seletor"><span>Unidade</span><strong>{user.unidade_nome}</strong></div>
        )}
        <nav>
          {MENU.filter((m) => isAdmin || (!m.admin && (!m.recurso || recursos[m.recurso]))).map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} title={label} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={20} />
              {!mini && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          {!mini && (
            <div className="user-box">
              <strong>{user.nome}</strong>
              <small>{isAdmin ? 'Administrador' : 'Técnico'}</small>
            </div>
          )}
          <button className="nav-item" onClick={logout} title="Sair"><LogOut size={20} />{!mini && <span>Sair</span>}</button>
          {!mobile && (
            <button className="nav-item" onClick={() => setRecolhido(!recolhido)} title={recolhido ? 'Expandir menu' : 'Recolher menu'}>
              {recolhido ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
              {!mini && <span>Recolher menu</span>}
            </button>
          )}
        </div>
      </aside>
      <main className="content" ref={conteudo}><Outlet /></main>
    </div>
  );
}
