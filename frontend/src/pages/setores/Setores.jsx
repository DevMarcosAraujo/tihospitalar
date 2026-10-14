import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Pencil, Plus, Power } from 'lucide-react';
import { api } from '../../api/client';
import { useApi, useDebounced } from '../../api/useApi';
import { useAuth } from '../../auth/AuthContext';
import { nomeEquip } from '../../utils/format';
import EquipamentoDetalhe from '../equipamentos/EquipamentoDetalhe';
import { Empty, ErrorMsg, Field, FormActions, Loading, Modal, Options, PageHeader, SearchBox } from '../../components/ui';

const COM_LEITO = ['SETOR PS/CDM', 'UTI', 'CENTRO CIRÚRGICO']; // divisões que têm beira leito
const VAZIO = { unidade_id: '', nome: '', localizacao: '', responsavel: '', ramal: '', observacoes: '', ativo: true };

function SetorForm({ setor, unidades, divisoes, onClose, onSaved }) {
  const [f, setF] = useState(setor ? { ...VAZIO, ...setor } : VAZIO);
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);
  // Divisão = macro-setor (UTI, Centro Cirúrgico…): escolhe uma existente ou cria outra
  const [novaDiv, setNovaDiv] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  function escolherDivisao(e) {
    if (e.target.value === '__nova') { setNovaDiv(true); setF({ ...f, localizacao: '' }); return; }
    set('localizacao')(e);
  }

  async function salvar(e) {
    e.preventDefault();
    setSaving(true); setErro('');
    try {
      await api(setor ? `/setores/${setor.id}` : '/setores', { method: setor ? 'PUT' : 'POST', body: f });
      onSaved();
    } catch (err) { setErro(err.message); setSaving(false); }
  }

  return (
    <Modal title={setor ? 'Editar setor' : 'Novo setor'} onClose={onClose}>
      <form onSubmit={salvar}>
        <ErrorMsg>{erro}</ErrorMsg>
        <div className="form-grid">
          <Field label="Unidade" required className="full">
            <select value={f.unidade_id} onChange={set('unidade_id')} required><Options items={unidades} vazio="Selecione…" /></select>
          </Field>
          <Field label="Nome" required className="full"><input value={f.nome} onChange={set('nome')} required autoFocus={!setor} /></Field>
          <Field label="Divisão" className="full" hint="Agrupa o setor, ex.: UTI, Centro Cirúrgico, Setor PS/CDM">
            {novaDiv ? (
              <input value={f.localizacao || ''} onChange={set('localizacao')} placeholder="Nome da nova divisão" autoFocus />
            ) : (
              <select value={f.localizacao || ''} onChange={escolherDivisao}>
                <option value="">Sem divisão</option>
                {divisoes.map((d) => <option key={d} value={d}>{d}</option>)}
                <option value="__nova">+ Nova divisão…</option>
              </select>
            )}
          </Field>
          <Field label="Ramal"><input value={f.ramal || ''} onChange={set('ramal')} inputMode="tel" /></Field>
          <Field label="Responsável pelo setor" className="full"><input value={f.responsavel || ''} onChange={set('responsavel')} /></Field>
          <Field label="Status" className="full">
            <select value={String(f.ativo)} onChange={(e) => setF({ ...f, ativo: e.target.value === 'true' })}>
              <option value="true">Ativo</option><option value="false">Inativo</option>
            </select>
          </Field>
          <Field label="Observações" className="full"><textarea value={f.observacoes || ''} onChange={set('observacoes')} /></Field>
        </div>
        <FormActions onCancel={onClose} saving={saving} />
      </form>
    </Modal>
  );
}

export default function Setores() {
  const { isAdmin, unidadeId } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [divisao, setDivisao] = useState('');
  const [inativos, setInativos] = useState(false);
  const [abertos, setAbertos] = useState({}); // começa tudo minimizado
  const [modal, setModal] = useState(null);
  const [ver, setVer] = useState(null);
  const [erro, setErro] = useState('');
  const busca = useDebounced(q);
  const unidades = useApi('/unidades');
  const { data, loading, error, reload } = useApi('/setores', { q: busca, unidade_id: unidadeId, inativos });
  const todos = useApi('/setores', { inativos: true });
  const resumoLeito = useApi('/equipamentos/beira-leito/resumo', { unidade_id: unidadeId });
  const leitos = Object.fromEntries((resumoLeito.data || []).map((r) => [r.divisao, r.total]));
  // Busca também por equipamento (hostname, TeamViewer, IP, patrimônio, modelo, série)
  const achados = useApi(busca.trim().length >= 2 ? '/equipamentos' : null, { q: busca.trim(), unidade_id: unidadeId });

  const divisoes = useMemo(
    () => [...new Set((todos.data || []).map((s) => s.localizacao).filter(Boolean))].sort(),
    [todos.data]
  );
  const grupos = useMemo(() => {
    const m = new Map();
    (data || []).filter((s) => !divisao || s.localizacao === divisao).forEach((s) => {
      const g = s.localizacao || 'Sem divisão';
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(s);
    });
    return [...m.entries()];
  }, [data, divisao]);

  const recarregar = () => { reload(); todos.reload(); };

  async function alternar(s) {
    setErro('');
    try { await api(`/setores/${s.id}/ativo`, { method: 'PATCH', body: { ativo: !s.ativo } }); recarregar(); }
    catch (err) { setErro(err.message); }
  }

  return (
    <>
      <PageHeader title="Setores" subtitle="Setores por divisão">
        {isAdmin && <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={18} /> Novo setor</button>}
      </PageHeader>

      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Buscar setor ou equipamento (hostname, TeamViewer, IP)…" />
      </div>
      {divisoes.length > 0 && (
        <div className="divisoes">
          <button className={!divisao ? 'ativo' : ''} onClick={() => setDivisao('')}>Todas</button>
          {divisoes.map((d) => (
            <button key={d} className={divisao === d ? 'ativo' : ''} onClick={() => setDivisao(d)}>{d}</button>
          ))}
        </div>
      )}
      {(isAdmin || (unidades.data || []).length > 1) && (
        <div className="toolbar">
          {isAdmin && (
            <label className="check"><input type="checkbox" checked={inativos} onChange={(e) => setInativos(e.target.checked)} /> Mostrar inativos</label>
          )}
        </div>
      )}
      <ErrorMsg>{erro || error}</ErrorMsg>

      {busca.trim().length >= 2 && (
        <section className="setores-grupo">
          <p className="setores-titulo">Equipamentos encontrados <span className="mapa-qtd">{achados.data?.length ?? '…'}</span></p>
          {achados.data?.length ? (
            <div className="setores-lista">
              {achados.data.map((e) => (
                <div key={e.id} className="setor-item">
                  <button type="button" className="setor-item-corpo" onClick={() => setVer(e)}>
                    <strong>{nomeEquip(e)}</strong>
                    <small className="muted">
                      {[e.tipo, e.setor_nome, e.teamviewer && `TeamViewer ${e.teamviewer}`, e.ip].filter(Boolean).join(' · ')}
                    </small>
                  </button>
                </div>
              ))}
            </div>
          ) : !achados.loading && <p className="muted">Nenhum equipamento encontrado.</p>}
        </section>
      )}

      {loading && !data ? <Loading /> : !grupos.length ? (busca.trim().length >= 2 ? null : <Empty />) : grupos.map(([nome, lista]) => {
        const aberto = !!busca || !!abertos[nome];
        return (
          <section key={nome} className="setores-grupo">
            <button type="button" className="setores-titulo" onClick={() => setAbertos({ ...abertos, [nome]: !aberto })}>
              {aberto ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              {nome} <span className="mapa-qtd">{lista.length}</span>
            </button>
            {aberto && (
              <div className="setores-lista">
                {COM_LEITO.includes(nome) && !busca.trim() && (
                  <Link to={`/beira-leito/${encodeURIComponent(nome)}`} className="setor-item leito-item">
                    <span className="setor-item-corpo"><strong>Beira leito</strong><small className="muted">Leitos da divisão</small></span>
                    <span className="setor-qtd">{leitos[nome] || 0}</span>
                  </Link>
                )}
                {lista.map((s) => (
                  <div key={s.id} className={`setor-item ${s.ativo ? '' : 'inativo'}`}>
                    <button type="button" className="setor-item-corpo" onClick={() => nav(`/setores/${s.id}`)}>
                      <strong>{s.nome}</strong>
                      <small className="muted">
                        {[!s.ativo && 'Inativo', s.ramal && `Ramal ${s.ramal}`].filter(Boolean).join(' · ') || s.unidade_nome}
                      </small>
                    </button>
                    <span className="setor-qtd" title="Equipamentos">{s.total_equipamentos}</span>
                    {isAdmin && (
                      <span className="acoes">
                        <button className="icon-btn" title="Editar" onClick={() => setModal(s)}><Pencil size={18} /></button>
                        <button className="icon-btn" title={s.ativo ? 'Inativar' : 'Reativar'} onClick={() => alternar(s)}><Power size={18} /></button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {ver && <EquipamentoDetalhe equip={ver} onClose={() => setVer(null)} />}
      {modal && (
        <SetorForm setor={modal.id ? modal : null} unidades={unidades.data} divisoes={divisoes}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); recarregar(); }} />
      )}
    </>
  );
}
