import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Laptop, Monitor, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { useApi, useDebounced } from '../../api/useApi';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Empty, ErrorMsg, Loading, PageHeader, SearchBox } from '../../components/ui';
import { STATUS_EQUIP, nomeEquip } from '../../utils/format';
import EquipamentoForm from '../equipamentos/EquipamentoForm';
import EquipamentoDetalhe from '../equipamentos/EquipamentoDetalhe';
import { ligacao } from '../equipamentos/Equipamentos';

export default function SetorDetalhe() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const [q, setQ] = useState('');
  const [aba, setAba] = useState('pc');
  const [modelo, setModelo] = useState('');
  const [novo, setNovo] = useState(false);
  const [edit, setEdit] = useState(null);
  const [ver, setVer] = useState(null);
  const [erro, setErro] = useState('');
  const busca = useDebounced(q);
  const setor = useApi(`/setores/${id}`);
  const unidades = useApi('/unidades');
  const categorias = useApi('/equipamentos/categorias');
  // O administrador também vê os inativos, para poder reativá-los
  const equips = useApi('/equipamentos', { setor_id: id, q: busca, inativos: isAdmin });
  const ABAS = [
    { id: 'pc', label: 'Computadores', cat: 'Computadores' },
    { id: 'impressora', label: 'Impressoras', cat: 'Impressoras' },
    { id: 'tv', label: 'TVs / Painéis', cat: 'Audiovisual' },
  ];
  const todos = equips.data || [];
  const daAba = (a) => todos.filter((e) => !a.cat || e.categoria === a.cat);
  const abaAtual = ABAS.find((a) => a.id === aba);
  // Sub-filtro da aba: Desktop/Notebook nos computadores, modelo nas impressoras
  const modelos = aba === 'pc' || aba === 'impressora' ? [...new Set(daAba(abaAtual).map((e) => e.tipo))].sort() : [];
  const chave = (e) => e.hostname || e.nome || e.ligado_a_hostname || e.numero_serie || e.tipo || '';
  const visiveis = daAba(abaAtual)
    .filter((e) => !modelo || e.tipo === modelo)
    .sort((a, b) => {
      const nat = (x, y) => x.localeCompare(y, 'pt-BR', { numeric: true, sensitivity: 'base' });
      const ga = a.sala || '', gb = b.sala || '';
      if (!ga !== !gb) return ga ? -1 : 1; // sem guichê por último
      return nat(ga, gb) || nat(chave(a), chave(b));
    });
  // Host: o do próprio equipamento; impressora sem host mostra o PC ao qual está ligada (ou o IP)
  const hostDe = (e) => e.hostname || (e.ligado_a_hostname ? `PC ${e.ligado_a_hostname}` : e.ip) || '—';

  const recarregar = () => { setor.reload(); equips.reload(); };

  async function alternar(e) {
    setErro('');
    try { await api(`/equipamentos/${e.id}/ativo`, { method: 'PATCH', body: { ativo: e.status === 'INATIVO' } }); recarregar(); }
    catch (err) { setErro(err.message); }
  }

  async function excluir(e) {
    if (!window.confirm(`Excluir "${nomeEquip(e)}" definitivamente? Esta ação não pode ser desfeita.`)) return;
    setErro('');
    try { await api(`/equipamentos/${e.id}`, { method: 'DELETE' }); recarregar(); }
    catch (err) { setErro(err.message); }
  }

  const s = setor.data;
  if (setor.loading && !s) return <Loading />;
  if (setor.error) return <ErrorMsg>{setor.error}</ErrorMsg>;

  return (
    <>
      <PageHeader title={s.nome} subtitle={s.localizacao ? `${s.unidade_nome} · ${s.localizacao}` : s.unidade_nome} back="/setores">
        <button className="btn btn-primary" onClick={() => setNovo(true)}><Plus size={18} /> Adicionar equipamento</button>
      </PageHeader>
      <div className="card">
        <dl className="info-grid">
          <div><dt>Divisão</dt><dd>{s.localizacao || '—'}</dd></div>
          <div><dt>Responsável</dt><dd>{s.responsavel || '—'}</dd></div>
          <div><dt>Ramal</dt><dd>{s.ramal || '—'}</dd></div>
          <div><dt>Observações</dt><dd>{s.observacoes || '—'}</dd></div>
        </dl>
      </div>

      <h2 className="mt">Resumo por categoria</h2>
      {s.resumo_categorias.length ? (
        <div className="chips">
          {s.resumo_categorias.map((c) => <span key={c.categoria_id} className="chip">{c.categoria}: {c.total}</span>)}
        </div>
      ) : <p className="muted">Sem equipamentos neste setor.</p>}

      <h2>Equipamentos</h2>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Hostname, TeamViewer, patrimônio, IP…" />
        
      </div>
      {ver && <EquipamentoDetalhe equip={ver} onClose={() => setVer(null)} />}
      <div className="mapa-abas">
        {ABAS.map((a) => (
          <button key={a.id} className={aba === a.id ? 'ativo' : ''} onClick={() => { setAba(a.id); setModelo(''); }}>
            {a.label} <span className="mapa-qtd">{daAba(a).length}</span>
          </button>
        ))}
      </div>
      {modelos.length > 1 && (
        <div className="divisoes">
          <button className={!modelo ? 'ativo' : ''} onClick={() => setModelo('')}>Todas</button>
          {modelos.map((m) => <button key={m} className={modelo === m ? 'ativo' : ''} onClick={() => setModelo(m)}>{m}</button>)}
        </div>
      )}
      <ErrorMsg>{erro}</ErrorMsg>
      <div className="table-wrap">
        {equips.loading && !equips.data ? <Loading /> : !visiveis.length ? <Empty>Nenhum equipamento nesta aba.</Empty> : (
          <table>
            <thead>
              <tr><th>Equipamento</th><th>Host</th><th>Guichê</th>{isAdmin && <th />}</tr>
            </thead>
            <tbody>
              {visiveis.map((e) => (
                <tr key={e.id} className={`clicavel ${e.status === 'INATIVO' ? 'inativo' : ''}`} onClick={() => setVer(e)}>
                  <td>{aba === 'pc' && (e.tipo === 'Notebook' ? <Laptop size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} /> : <Monitor size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />)}<strong>{e.nome || e.tipo}</strong>{e.status !== 'ATIVO' && <> <Badge map={STATUS_EQUIP} value={e.status} /></>}</td>
                  <td>{hostDe(e)}</td>
                  <td>{e.sala || '—'}</td>
                  {isAdmin && (
                    <td className="acoes" onClick={(ev) => ev.stopPropagation()}>
                      <button className="icon-btn" title="Editar" onClick={() => setEdit(e)}><Pencil size={17} /></button>
                      <button className="icon-btn" title={e.status === 'INATIVO' ? 'Reativar' : 'Inativar'} onClick={() => alternar(e)}><Power size={17} /></button>
                      <button className="icon-btn" title="Excluir" onClick={() => excluir(e)}><Trash2 size={17} color="var(--red)" /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <button className="fab" onClick={() => setNovo(true)} aria-label="Adicionar equipamento"><Plus size={26} /></button>
      {edit && (
        <EquipamentoForm equip={edit} categorias={categorias.data} unidades={unidades.data}
          onClose={() => setEdit(null)} onSaved={() => { setEdit(null); recarregar(); }} />
      )}
      {novo && (
        <EquipamentoForm inicial={{ unidade_id: s.unidade_id, setor_id: s.id }} categorias={categorias.data} unidades={unidades.data}
          onClose={() => setNovo(false)} onSaved={() => { setNovo(false); recarregar(); }} />
      )}
    </>
  );
}
