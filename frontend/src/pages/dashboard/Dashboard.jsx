import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, ChevronRight } from 'lucide-react';
import { api } from '../../api/client';
import { fmtDateTime } from '../../utils/format';
import { useAuth } from '../../auth/AuthContext';
import { useApi } from '../../api/useApi';
import { ErrorMsg, Loading, PageHeader } from '../../components/ui';

// Notificação para o administrador: novos cadastros de equipamentos feitos pelos técnicos, por unidade
function PainelAtividades({ unidadeId }) {
  const { data, reload } = useApi('/atividades/resumo', { unidade_id: unidadeId });
  useEffect(() => { const t = setInterval(reload, 30000); return () => clearInterval(t); }, [reload]);
  if (!data) return null;

  async function marcarVistas() {
    try { await api('/atividades/visto', { method: 'POST' }); } catch { /* tenta de novo no próximo clique */ }
    reload();
  }

  return (
    <div className={`card painel-atividades ${data.nao_vistas ? 'tem-novas' : ''}`}>
      <div className="painel-topo">
        <h2 style={{ margin: 0 }}><Bell size={20} style={{ verticalAlign: '-3px', marginRight: 8 }} />Novos cadastros dos técnicos
          {data.nao_vistas > 0 && <span className="sino-num">{data.nao_vistas}</span>}</h2>
        <div className="painel-acoes">
          {data.nao_vistas > 0 && <button className="btn btn-sm" onClick={marcarVistas}>Marcar como vistos</button>}
        </div>
      </div>
      {data.recentes.length === 0 ? <p className="muted" style={{ margin: 0 }}>Nenhum técnico cadastrou equipamentos ainda.</p> : (
        <>
          {data.por_unidade.some((u) => u.novas > 0) && (
            <div className="chips" style={{ marginBottom: '.75rem' }}>
              {data.por_unidade.filter((u) => u.novas > 0).map((u) => <span key={u.unidade_nome} className="chip">{u.unidade_nome}: {u.novas} novo(s)</span>)}
            </div>
          )}
          <ul className="atividades-lista">
            {data.recentes.map((a) => (
              <li key={a.id} className={a.nova ? 'nova' : ''}>
                <CheckCircle2 size={18} className="tik" />
                <div>
                  <strong>{a.usuario_nome}</strong> cadastrou {a.descricao}
                  <div className="muted">{fmtDateTime(a.criado_em)}{a.unidade_nome ? ` · ${a.unidade_nome}` : ''}</div>
                </div>
              </li>
            ))}
          </ul>
          <Link to="/atividades" className="btn btn-sm" style={{ marginTop: '.75rem' }}>Ver todas as atividades</Link>
        </>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { isAdmin, user, unidadeId, setUnidadeAtiva } = useAuth();
  const { data, loading, error } = useApi('/dashboard', { unidade_id: unidadeId });

  const unidades = useApi('/unidades');
  const servicos = useApi('/servicos/resumo');
  const nav = useNavigate();
  const abrirUnidade = (id) => { if (isAdmin) setUnidadeAtiva(String(id)); nav('/setores'); };

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
          {isAdmin && (servicos.data?.aprovar > 0 || servicos.data?.devolvidos > 0) && (
            <Link to="/servicos" className="aviso-servicos">{[servicos.data.aprovar > 0 && `${servicos.data.aprovar} aguardando aprovação`, servicos.data.devolvidos > 0 && `${servicos.data.devolvidos} pendente(s) para atribuir a outro técnico`].filter(Boolean).join(' · ')} <ChevronRight size={18} /></Link>
          )}
          {!isAdmin && servicos.data?.abertos > 0 && (
            <Link to="/servicos" className="aviso-servicos">Você tem {servicos.data.abertos} serviço(s) para fazer{servicos.data.reprovados > 0 ? ` (${servicos.data.reprovados} reprovado(s) para refazer)` : ''} <ChevronRight size={18} /></Link>
          )}
          <div className="stats">
            {cards.map(([rotulo, valor, alerta]) => (
              <div key={rotulo} className={`stat ${alerta ? 'warn' : ''}`}><span>{rotulo}</span><strong>{valor}</strong></div>
            ))}
          </div>
          <h2>Unidades</h2>
          {!(unidades.data || []).length && <p className="muted">Nenhuma unidade cadastrada.</p>}
          <div className="setores-grid">
            {(unidades.data || []).map((u) => (
              <button key={u.id} type="button" className="setor-tile" onClick={() => abrirUnidade(u.id)}>
                <span>{u.nome}<small className="muted" style={{ display: 'block' }}>{u.total_setores} setor(es) · {u.total_equipamentos} equipamento(s)</small></span>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
          {isAdmin && <PainelAtividades unidadeId={unidadeId} />}
        </>
      )}
    </>
  );
}
