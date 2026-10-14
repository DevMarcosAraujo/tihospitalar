import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useApi } from '../../api/useApi';
import { ErrorMsg, Loading, Options, PageHeader, SearchBox } from '../../components/ui';

const COM_LEITO = ['SETOR PS/CDM', 'UTI', 'CENTRO CIRÚRGICO']; // divisões que têm beira leito

export default function Dashboard() {
  const { isAdmin, user, unidadeId } = useAuth();
  const { data, loading, error } = useApi('/dashboard', { unidade_id: unidadeId });

  // Setores de todas as unidades, visíveis para qualquer perfil, agrupados por macro-setor
  const setores = useApi('/setores', { unidade_id: unidadeId });
  const resumoLeito = useApi('/equipamentos/beira-leito/resumo', { unidade_id: unidadeId });
  const leitos = Object.fromEntries((resumoLeito.data || []).map((r) => [r.divisao, r.total]));
  const [busca, setBusca] = useState('');
  const [abertos, setAbertos] = useState({}); // macro-setores: começam minimizados
  const grupos = useMemo(() => {
    const m = new Map();
    const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const termo = norm(busca.trim());
    (setores.data || []).filter((st) => !termo || norm(st.nome).includes(termo) || norm(st.localizacao).includes(termo)).forEach((st) => {
      const g = st.localizacao || 'Outros';
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(st);
    });
    return [...m.entries()];
  }, [setores.data, busca]);

  const c = data?.cards;
  const cards = c && [
    ['Equipamentos', c.total_equipamentos], ['Unidades', c.total_unidades], ['Setores', c.total_setores],
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Olá, ${user.nome.split(' ')[0]}`}>
      </PageHeader>
      <ErrorMsg>{error}</ErrorMsg>
      {loading && !data ? <Loading /> : data && (
        <>
          <div className="stats">
            {cards.map(([rotulo, valor, alerta]) => (
              <div key={rotulo} className={`stat ${alerta ? 'warn' : ''}`}><span>{rotulo}</span><strong>{valor}</strong></div>
            ))}
          </div>
          <h2>Setores</h2>
          <div className="toolbar">
            <SearchBox value={busca} onChange={setBusca} placeholder="Buscar setor…" />
          </div>
          {!grupos.length && <p className="muted">Nenhum setor encontrado.</p>}
          {grupos.map(([macro, lista]) => {
            const aberto = !!busca.trim() || !!abertos[macro]; // buscando, mostra os resultados
            return (
            <div key={macro} className="setores-grupo">
              <button type="button" className="setores-titulo" onClick={() => setAbertos({ ...abertos, [macro]: !aberto })}>
                {aberto ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                {macro} <span className="mapa-qtd">{lista.length}</span>
              </button>
              {aberto && <div className="setores-grid">
                {COM_LEITO.includes(macro) && !busca.trim() && (
                  <Link to={`/beira-leito/${encodeURIComponent(macro)}`} className="setor-tile leito-tile">
                    <span>Beira leito</span><strong>{leitos[macro] || 0}</strong>
                  </Link>
                )}
                {lista.map((st) => (
                  <Link key={st.id} to={`/setores/${st.id}`} className="setor-tile">
                    <span>{st.nome}</span>
                    <strong>{st.total_equipamentos}</strong>
                  </Link>
                ))}
              </div>}
            </div>
            );
          })}
        </>
      )}
    </>
  );
}
