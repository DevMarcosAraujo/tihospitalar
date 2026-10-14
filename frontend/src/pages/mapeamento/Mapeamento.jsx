import { useMemo, useState } from 'react';
import { Building2, Monitor, MapPin, Pencil, Plus, Printer, Trash2, Tv, Boxes, Eye, EyeOff } from 'lucide-react';
import { api } from '../../api/client';
import { useApi } from '../../api/useApi';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Empty, ErrorMsg, Loading, PageHeader } from '../../components/ui';
import { STATUS_EQUIP, nomeEquip } from '../../utils/format';
import EquipamentoForm from '../equipamentos/EquipamentoForm';
import EquipamentoDetalhe from '../equipamentos/EquipamentoDetalhe';
import { ligacao } from '../equipamentos/Equipamentos';

// Abas do mapeamento: agrupam as categorias do sistema como no HTML antigo (PCs, Impressoras, TVs/Painéis)
const ABAS = [
  { id: 'pc', label: 'Computadores', icon: Monitor, categorias: ['Computadores'] },
  { id: 'impressora', label: 'Impressoras', icon: Printer, categorias: ['Impressoras'] },
  { id: 'tv', label: 'TVs / Painéis', icon: Tv, categorias: ['Audiovisual'] },
  { id: 'outros', label: 'Outros', icon: Boxes, categorias: null },
];
const abaDe = (e) => ABAS.find((a) => a.categorias?.includes(e.categoria))?.id || 'outros';

export default function Mapeamento() {
  const { isAdmin, recursos, liberarMapeamento, unidadeId } = useAuth();
  const liberado = recursos.mapeamento_tecnicos;
  const [setorId, setSetorId] = useState(null);
  const [aba, setAba] = useState('pc');
  const [modal, setModal] = useState(null);
  const [ver, setVer] = useState(null);
  const [erro, setErro] = useState('');

  const setores = useApi('/setores', { unidade_id: unidadeId });
  const unidades = useApi('/unidades');
  const categorias = useApi('/equipamentos/categorias');
  const equips = useApi(setorId ? '/equipamentos' : null, { setor_id: setorId });

  // Menu lateral: macro-setor (localizacao) → salas (setores)
  const grupos = useMemo(() => {
    const m = new Map();
    (setores.data || []).forEach((s) => {
      const g = s.localizacao || 'SEM GRUPO';
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(s);
    });
    return [...m.entries()];
  }, [setores.data]);

  const setor = (setores.data || []).find((s) => s.id === setorId);
  const lista = (equips.data || []).filter((e) => abaDe(e) === aba);
  const contagem = (id) => (equips.data || []).filter((e) => abaDe(e) === id).length;

  async function excluir(e) {
    if (!window.confirm(`Excluir "${nomeEquip(e)}" definitivamente? Esta ação não pode ser desfeita.`)) return;
    setErro('');
    try { await api(`/equipamentos/${e.id}`, { method: 'DELETE' }); equips.reload(); setores.reload(); }
    catch (err) { setErro(err.message); }
  }

  const novo = () => setModal({ inicial: { unidade_id: setor?.unidade_id, setor_id: setor?.id } });

  return (
    <>
      <PageHeader title="Mapeamento" subtitle={isAdmin ? (liberado ? 'Visível para os técnicos' : 'Visível só para administradores') : 'Equipamentos por setor'}>
        {isAdmin && (
          <button className="btn" onClick={() => liberarMapeamento(!liberado).catch((e) => setErro(e.message))}>
            {liberado ? <><EyeOff size={18} /> Ocultar dos técnicos</> : <><Eye size={18} /> Liberar para técnicos</>}
          </button>
        )}
        {setor && <button className="btn btn-primary" onClick={novo}><Plus size={18} /> Adicionar equipamento</button>}
      </PageHeader>
      <ErrorMsg>{erro || setores.error}</ErrorMsg>

      <div className="mapa">
        <aside className="mapa-menu card">
          {setores.loading && !setores.data ? <Loading /> : grupos.map(([macro, salas]) => (
            <div key={macro} className="mapa-grupo">
              <div className="mapa-macro"><Building2 size={16} /> {macro}</div>
              {salas.map((s) => (
                <button key={s.id} className={`mapa-sala ${s.id === setorId ? 'ativo' : ''}`} onClick={() => { setSetorId(s.id); setErro(''); }}>
                  <span>{s.nome}</span>
                  {s.total_equipamentos > 0 && <small>{s.total_equipamentos}</small>}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <section className="mapa-conteudo">
          {!setor ? (
            <Empty>Selecione um setor no menu ao lado para ver os equipamentos.</Empty>
          ) : (
            <>
              <div className="card">
                <p className="mapa-macro-tit">{setor.localizacao}</p>
                <h2 className="mapa-sala-tit">{setor.nome}</h2>
              </div>
              <div className="mapa-abas">
                {ABAS.map(({ id, label, icon: Icon }) => (
                  <button key={id} className={aba === id ? 'ativo' : ''} onClick={() => setAba(id)}>
                    <Icon size={18} /> {label} <span className="mapa-qtd">{contagem(id)}</span>
                  </button>
                ))}
              </div>
              {equips.loading && !equips.data ? <Loading /> : !lista.length ? (
                <Empty>Nenhum equipamento desta aba cadastrado neste setor.</Empty>
              ) : (
                <div className="mapa-grid">
                  {lista.map((e) => (
                    <article key={e.id} className="mapa-card card" style={{ cursor: 'pointer' }} onClick={() => setVer(e)}>
                      <header>
                        <div>
                          <small className="muted">{e.tipo}</small>
                          <h3>{nomeEquip(e)}</h3>
                          {e.sala && <span className="mapa-pos"><MapPin size={12} /> {e.sala}</span>}
                        </div>
                        {isAdmin && (
                          <div className="acoes" onClick={(ev) => ev.stopPropagation()}>
                            <button className="icon-btn" title="Editar" onClick={() => setModal({ equip: e })}><Pencil size={17} /></button>
                            <button className="icon-btn" title="Excluir" onClick={() => excluir(e)}><Trash2 size={17} color="var(--red)" /></button>
                          </div>
                        )}
                      </header>
                      <dl className="mapa-dados">
                        {e.ip && <div><dt>IP</dt><dd className="mono">{e.ip}</dd></div>}
                        {e.modelo && <div><dt>Modelo</dt><dd>{e.modelo}</dd></div>}
                        {e.numero_serie && <div><dt>Série</dt><dd className="mono">{e.numero_serie}</dd></div>}
                        {e.teamviewer && <div className="destaque"><dt>TeamViewer</dt><dd className="mono">{e.teamviewer}{e.teamviewer_senha ? ' · senha ' + e.teamviewer_senha : ''}</dd></div>}
                        {(e.impressoras?.length > 0 || e.ligado_a_id) && <div><dt>Ligação</dt><dd>{ligacao(e)}</dd></div>}
                      </dl>
                      <Badge map={STATUS_EQUIP} value={e.status} />
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {ver && <EquipamentoDetalhe equip={ver} onClose={() => setVer(null)} />}
      {setor && <button className="fab" onClick={novo} aria-label="Adicionar equipamento"><Plus size={26} /></button>}
      {modal && (
        <EquipamentoForm equip={modal.equip} inicial={modal.inicial} categorias={categorias.data} unidades={unidades.data}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); equips.reload(); setores.reload(); }} />
      )}
    </>
  );
}
