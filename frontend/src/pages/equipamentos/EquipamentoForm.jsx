import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../../api/client';
import { useApi } from '../../api/useApi';
import { useAuth } from '../../auth/AuthContext';
import { ErrorMsg, Field, FormActions, Modal } from '../../components/ui';

// Os três tipos do cadastro e a categoria do banco que cada um usa
const TIPOS = [
  { id: 'pc', label: 'Computador (PC)', categoria: 'Computadores', tipo: 'Desktop' },
  { id: 'impressora', label: 'Impressora', categoria: 'Impressoras' },
  { id: 'tv', label: 'TV / Painel de Chamada', categoria: 'Audiovisual', tipo: 'TV' },
];

const tipoDe = (equip) => TIPOS.find((t) => t.categoria === equip?.categoria)?.id || 'pc';

/**
 * Cadastro/edição de equipamento: Divisão → Setor → (posição opcional) → Tipo → campos do tipo.
 *   PC: hostname + TeamViewer (ID e senha)
 *   Impressora: modelo (Multifuncional, Zebra, Pulseira, Térmica) + nº de série;
 *               Multifuncional leva IP; as demais ficam ligadas a um PC (hostname)
 *   TV/Painel: hostname + TeamViewer (ID e senha)
 */
export default function EquipamentoForm({ equip, inicial, onClose, onSaved }) {
  const { user, isAdmin, unidadeId } = useAuth();
  const setores = useApi('/setores', { unidade_id: unidadeId });
  const categorias = useApi('/equipamentos/categorias');
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);
  const [novoModelo, setNovoModelo] = useState(null); // { nome, usa_ip } enquanto o admin cadastra um modelo
  const [f, setF] = useState(() => ({
    setor_id: equip?.setor_id || inicial?.setor_id || '',
    sala: equip?.sala || '',
    tipo: equip ? tipoDe(equip) : (inicial?.tipo || 'pc'),
    tipo_id: equip?.tipo_id || '',
    nome: equip?.nome || '',
    hostname: equip?.hostname || '',
    ip: equip?.ip || '',
    numero_serie: equip?.numero_serie || '',
    fabricante: equip?.fabricante || '',
    modelo_txt: equip?.modelo || '',
    teamviewer: equip?.teamviewer || '',
    teamviewer_senha: equip?.teamviewer_senha || '',
    ligado_a_id: equip?.ligado_a_id || '',
  }));
  const [divisao, setDivisao] = useState('');
  const [mostrarPosicao, setMostrarPosicao] = useState(!!equip?.sala);

  const lista = setores.data || [];
  const setorAtual = lista.find((s) => String(s.id) === String(f.setor_id));
  const divisoes = useMemo(() => [...new Set(lista.map((s) => s.localizacao || 'Sem divisão'))].sort(), [lista]);
  const divAtiva = divisao || (setorAtual ? setorAtual.localizacao || 'Sem divisão' : '');
  const salas = lista.filter((s) => (s.localizacao || 'Sem divisão') === divAtiva);
  const semUnidade = !isAdmin && !user.unidade_id;

  const cats = categorias.data || [];
  const catImp = cats.find((c) => c.nome === 'Impressoras');
  const catPc = cats.find((c) => c.nome === 'Computadores');
  const modelos = catImp?.tipos || [];
  const modelo = modelos.find((m) => String(m.id) === String(f.tipo_id));
  const usaIp = !!modelo?.usa_ip;

  // Computadores do setor, para ligar a impressora sem IP
  const pcs = useApi(f.tipo === 'impressora' && !usaIp && f.setor_id && catPc ? '/equipamentos' : null,
    { setor_id: f.setor_id, categoria_id: catPc?.id });

  // Computador: Desktop ou Notebook (mantém outro tipo já gravado, ex.: All-in-One)
  const tiposPc = (catPc?.tipos || []).filter((t) => ['Desktop', 'Notebook'].includes(t.nome) || String(t.id) === String(equip?.tipo_id));
  const pcAtual = tiposPc.find((t) => String(t.id) === String(f.tipo_id)) || tiposPc.find((t) => t.nome === 'Desktop');

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const upper = (k) => (e) => setF({ ...f, [k]: e.target.value.toUpperCase() });

  async function cadastrarModelo() {
    setErro('');
    try {
      const r = await api('/equipamentos/modelos', { method: 'POST', body: { nome: novoModelo.nome, usa_ip: novoModelo.usa_ip } });
      await categorias.reload();
      setF((x) => ({ ...x, tipo_id: r.id }));
      setNovoModelo(null);
    } catch (err) { setErro(err.message); }
  }

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    if (f.tipo === 'impressora' && !f.tipo_id) { setErro('Escolha o modelo da impressora'); return; }
    if (f.tipo === 'impressora' && !usaIp && !f.ligado_a_id) { setErro('Escolha o computador (host) ao qual a impressora está conectada'); return; }
    setSaving(true);
    try {
      // Admin: grava o link/pasta dos drivers do modelo escolhido
      if (isAdmin && f.tipo === 'impressora' && f.tipo_id && f.drivers !== undefined) {
        await api(`/equipamentos/modelos/${f.tipo_id}/drivers`, { method: 'PUT', body: { link_drivers: f.drivers } });
      }
      const def = TIPOS.find((t) => t.id === f.tipo);
      const cat = cats.find((c) => c.nome === def.categoria);
      let tipoId = f.tipo_id;
      if (f.tipo === 'pc' && cat?.tipos.some((t) => String(t.id) === String(f.tipo_id))) {
        tipoId = f.tipo_id; // Desktop ou Notebook escolhido
      } else if (f.tipo !== 'impressora') {
        // Ao editar sem trocar o tipo, mantém o tipo que já estava gravado
        tipoId = equip && f.tipo === tipoDe(equip) ? equip.tipo_id : cat?.tipos.find((t) => t.nome === def.tipo)?.id || cat?.tipos[0]?.id;
      }
      if (!tipoId) throw new Error('Tipo de equipamento indisponível. Fale com o administrador.');

      const body = {
        tipo_id: tipoId,
        setor_id: f.setor_id,
        unidade_id: setorAtual?.unidade_id,
        sala: f.sala,
        status: equip?.status || 'ATIVO',
        patrimonio: equip?.patrimonio || '',
        fabricante: equip?.fabricante || '',
        modelo: equip?.modelo || '',
        observacoes: equip?.observacoes || '',
        ...(f.tipo === 'pc' && { hostname: f.hostname, teamviewer: f.teamviewer, teamviewer_senha: f.teamviewer_senha }),
        ...(f.tipo === 'tv' && { nome: f.nome, hostname: f.hostname, teamviewer: f.teamviewer, teamviewer_senha: f.teamviewer_senha }),
        ...(f.tipo === 'impressora' && {
          fabricante: f.fabricante,
          modelo: f.modelo_txt,
          numero_serie: f.numero_serie,
          ip: usaIp ? f.ip : '',
          ligado_a_id: usaIp ? null : f.ligado_a_id,
        }),
      };
      await api(equip ? `/equipamentos/${equip.id}` : '/equipamentos', { method: equip ? 'PUT' : 'POST', body });
      onSaved();
    } catch (err) { setErro(err.message); setSaving(false); }
  }

  const acessoRemoto = (
    <>
      <Field label="ID TeamViewer / AnyDesk" className="lado">
        <input value={f.teamviewer} onChange={set('teamviewer')} inputMode="numeric" placeholder="Ex.: 123 456 789" />
      </Field>
      <Field label="Senha de acesso" className="lado">
        <input value={f.teamviewer_senha} onChange={set('teamviewer_senha')} autoComplete="off" placeholder="Senha do acesso remoto" />
      </Field>
    </>
  );

  return (
    <Modal title={equip ? 'Editar equipamento' : 'Vincular equipamento'} onClose={onClose}>
      <form onSubmit={salvar}>
        <ErrorMsg>{erro}</ErrorMsg>
        {semUnidade && <ErrorMsg>Seu usuário ainda não está ligado a uma unidade. Peça ao administrador para definir.</ErrorMsg>}

        <div className="form-grid">
          <Field label="Divisão" className="full">
            <select value={divAtiva} onChange={(e) => { setDivisao(e.target.value); setF({ ...f, setor_id: '', ligado_a_id: '' }); }} required>
              <option value="">Selecione…</option>
              {divisoes.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Setor" required className="full">
            <select value={f.setor_id} onChange={(e) => setF({ ...f, setor_id: e.target.value, ligado_a_id: '' })} required disabled={!divAtiva}>
              <option value="">{divAtiva ? 'Selecione…' : 'Escolha a divisão primeiro'}</option>
              {salas.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </Field>
          {mostrarPosicao || f.tipo === 'pc' ? (
            <Field label={f.tipo === 'pc' ? 'Guichê / posição' : 'Posição / sub-setor'} className="full"
              hint={f.tipo === 'pc' ? 'A lista do setor é ordenada por este campo: use GUICHÊ 01, GUICHÊ 02, GUICHÊ 03…' : undefined}>
              <input value={f.sala} onChange={upper('sala')} placeholder={f.tipo === 'pc' ? 'Ex.: GUICHÊ 01' : 'Ex.: Consultório 1, Black 1, Leito 2…'} />
            </Field>
          ) : (
            <div className="full">
              <button type="button" className="btn btn-sm" onClick={() => setMostrarPosicao(true)}><Plus size={15} /> Adicionar posição / sub-setor</button>
            </div>
          )}
        </div>

        <section className="passo">
          <h3>Tipo de equipamento</h3>
          <div className="escolhas">
            {TIPOS.map((t) => (
              <button type="button" key={t.id} className={`escolha ${f.tipo === t.id ? 'sel' : ''}`} onClick={() => setF({ ...f, tipo: t.id })}>
                {t.label}
              </button>
            ))}
          </div>
        </section>

        <div className="form-grid">
          {f.tipo === 'pc' && tiposPc.length > 0 && (
            <div className="full">
              <h3 className="passo-sub">Tipo do computador</h3>
              <div className="escolhas dois">
                {tiposPc.map((t) => (
                  <button type="button" key={t.id} className={`escolha ${pcAtual?.id === t.id ? 'sel' : ''}`}
                    onClick={() => setF({ ...f, tipo_id: t.id })}>{t.nome}</button>
                ))}
              </div>
            </div>
          )}

          {(f.tipo === 'pc' || f.tipo === 'tv') && (
            <>
              {f.tipo === 'tv' && (
                <Field label="Nome do painel" required className="full" hint="Como o painel será identificado no sistema">
                  <input value={f.nome} onChange={set('nome')} required autoFocus placeholder="Ex.: Painel de chamada - Recepção" />
                </Field>
              )}
              <Field label={f.tipo === 'pc' ? 'Hostname (nome do computador)' : 'Hostname (mini PC)'} required className="full">
                <input value={f.hostname} onChange={upper('hostname')} required placeholder={f.tipo === 'pc' ? 'Ex.: PC-REC-01' : 'Ex.: TV-PAINEL-01'} />
              </Field>
              {acessoRemoto}
            </>
          )}

          {f.tipo === 'impressora' && (
            <>
              <div className="full">
                <h3 className="passo-sub">Modelo</h3>
                <div className="escolhas">
                  {modelos.map((m) => (
                    <button type="button" key={m.id} className={`escolha ${String(f.tipo_id) === String(m.id) ? 'sel' : ''}`}
                      onClick={() => setF({ ...f, tipo_id: m.id, ligado_a_id: '' })}>{m.nome}</button>
                  ))}
                  {!novoModelo && (
                    <button type="button" className="escolha" onClick={() => setNovoModelo({ nome: '', usa_ip: false })}><Plus size={15} /> Novo modelo</button>
                  )}
                </div>
                {novoModelo && (
                  <div className="resumo-tipo" style={{ marginTop: '.75rem', flexWrap: 'wrap', gap: '.5rem' }}>
                    <input value={novoModelo.nome} onChange={(e) => setNovoModelo({ ...novoModelo, nome: e.target.value })} placeholder="Nome do modelo" autoFocus />
                    <label className="check">
                      <input type="checkbox" checked={novoModelo.usa_ip} onChange={(e) => setNovoModelo({ ...novoModelo, usa_ip: e.target.checked })} /> Usa IP
                    </label>
                    <button type="button" className="btn btn-sm btn-primary" disabled={!novoModelo.nome.trim()} onClick={cadastrarModelo}>Adicionar</button>
                    <button type="button" className="btn btn-sm" onClick={() => setNovoModelo(null)}>Cancelar</button>
                  </div>
                )}
              </div>

              {isAdmin && modelo && (
                <Field label={`Link / pasta dos drivers (${modelo.nome})`} className="full" hint="Vale para todas as impressoras deste modelo. Só o administrador altera.">
                  <input value={f.drivers ?? modelo.link_drivers ?? ''} onChange={set('drivers')} placeholder="Ex.: \\\\servidor\\drivers\\zebra ou https://…" />
                </Field>
              )}

              <Field label="Marca" className="lado">
                <input value={f.fabricante} onChange={set('fabricante')} placeholder="Ex.: Zebra, Brother, HP" />
              </Field>
              <Field label="Modelo da impressora" className="lado">
                <input value={f.modelo_txt} onChange={set('modelo_txt')} placeholder="Ex.: ZD220, L5652" />
              </Field>

              <Field label="Número de série" required className="full" hint="Não pode repetir">
                <input value={f.numero_serie} onChange={upper('numero_serie')} required placeholder="Ex.: U654321A" />
              </Field>

              {modelo && usaIp && (
                <Field label="Endereço IP" required className="full">
                  <input value={f.ip} onChange={(e) => setF({ ...f, ip: e.target.value.replace(/[,;s]/g, '.').replace(/.{2,}/g, '.') })} required inputMode="decimal" autoComplete="off" placeholder="Ex.: 10.0.1.50" />
                </Field>
              )}

              {modelo && !usaIp && (
                <Field label="Computador conectado (host)" required className="full"
                  hint={!f.setor_id ? 'Escolha o setor primeiro' : pcs.data && !pcs.data.length ? 'Nenhum computador cadastrado neste setor. Cadastre o PC primeiro.' : undefined}>
                  <select value={f.ligado_a_id} onChange={set('ligado_a_id')} disabled={!f.setor_id}>
                    <option value="">Selecione o PC…</option>
                    {(pcs.data || []).map((p) => <option key={p.id} value={p.id}>{p.hostname || p.patrimonio || `PC ${p.id}`}</option>)}
                  </select>
                </Field>
              )}
            </>
          )}
        </div>

        <FormActions onCancel={onClose} saving={saving} disabled={semUnidade || !f.setor_id} label="Salvar" />
      </form>
    </Modal>
  );
}
