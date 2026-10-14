import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { useApi } from '../../api/useApi';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Empty, ErrorMsg, Field, FormActions, Loading, Modal, PageHeader } from '../../components/ui';
import { STATUS_EQUIP } from '../../utils/format';
import EquipamentoDetalhe from '../equipamentos/EquipamentoDetalhe';

const nat = (a, b) => (a || '').localeCompare(b || '', 'pt-BR', { numeric: true, sensitivity: 'base' });

function LeitoForm({ leito, divisao, tipoId, unidadeId, onClose, onSaved }) {
  const [f, setF] = useState({
    sala: leito?.sala || '', hostname: leito?.hostname || '',
    teamviewer: leito?.teamviewer || '', teamviewer_senha: leito?.teamviewer_senha || '',
  });
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const upper = (k) => (e) => setF({ ...f, [k]: e.target.value.toUpperCase() });

  async function salvar(e) {
    e.preventDefault();
    setSaving(true); setErro('');
    try {
      const body = { ...f, tipo_id: tipoId, divisao, status: leito?.status || 'ATIVO', unidade_id: leito?.unidade_id || unidadeId || undefined };
      await api(leito ? `/equipamentos/${leito.id}` : '/equipamentos', { method: leito ? 'PUT' : 'POST', body });
      onSaved();
    } catch (err) { setErro(err.message); setSaving(false); }
  }

  return (
    <Modal title={leito ? 'Editar beira leito' : 'Novo beira leito'} onClose={onClose}>
      <form onSubmit={salvar}>
        <ErrorMsg>{erro}</ErrorMsg>
        <div className="form-grid">
          <Field label="Número do beira leito" required className="full" hint="A lista é ordenada por este número: LEITO 01, LEITO 02…">
            <input value={f.sala} onChange={upper('sala')} required autoFocus placeholder="Ex.: LEITO 01" />
          </Field>
          <Field label="Hostname" required className="full">
            <input value={f.hostname} onChange={upper('hostname')} required placeholder="Ex.: UTI-BL-01" />
          </Field>
          <Field label="ID TeamViewer / AnyDesk" className="lado">
            <input value={f.teamviewer} onChange={set('teamviewer')} inputMode="numeric" placeholder="Ex.: 123 456 789" />
          </Field>
          <Field label="Senha de acesso" className="lado">
            <input value={f.teamviewer_senha} onChange={set('teamviewer_senha')} autoComplete="off" />
          </Field>
        </div>
        <FormActions onCancel={onClose} saving={saving} />
      </form>
    </Modal>
  );
}

// Beira leito de uma divisão (UTI, Centro Cirúrgico, PS/CDM): número do leito, hostname e TeamViewer
export default function BeiraLeito() {
  const { divisao: param } = useParams();
  const divisao = decodeURIComponent(param);
  const { isAdmin, unidadeId } = useAuth();
  const unidades = useApi(isAdmin ? '/unidades' : null);
  const [ver, setVer] = useState(null);
  const [modal, setModal] = useState(null);
  const [erro, setErro] = useState('');
  const categorias = useApi('/equipamentos/categorias');
  const { data, loading, error, reload } = useApi('/equipamentos', { divisao, inativos: isAdmin, unidade_id: unidadeId });
  const tipoId = (categorias.data || []).find((c) => c.nome === 'Beira leito')?.tipos[0]?.id;
  // Admin com várias unidades precisa escolher uma no menu para cadastrar (evita misturar as unidades)
  const precisaUnidade = isAdmin && !unidadeId && (unidades.data || []).length > 1;
  const lista = [...(data || [])].sort((a, b) => nat(a.sala, b.sala));

  async function excluir(l) {
    if (!window.confirm(`Excluir o beira leito "${l.sala}" definitivamente? Esta ação não pode ser desfeita.`)) return;
    setErro('');
    try { await api(`/equipamentos/${l.id}`, { method: 'DELETE' }); reload(); }
    catch (err) { setErro(err.message); }
  }

  return (
    <>
      <PageHeader title="Beira leito" subtitle={divisao} back="/setores">
        <button className="btn btn-primary" disabled={!tipoId || precisaUnidade} onClick={() => setModal({})}><Plus size={18} /> Adicionar</button>
      </PageHeader>
      <ErrorMsg>{erro || error}</ErrorMsg>
      {precisaUnidade && <p className="muted">Selecione uma unidade no menu para adicionar beira leito.</p>}

      <div className="table-wrap">
        {loading && !data ? <Loading /> : !lista.length ? <Empty>Nenhum beira leito cadastrado nesta divisão.</Empty> : (
          <table>
            <thead><tr><th>Nº do leito</th><th>Host</th><th>TeamViewer</th>{isAdmin && <th />}</tr></thead>
            <tbody>
              {lista.map((l) => (
                <tr key={l.id} className={`clicavel ${l.status === 'INATIVO' ? 'inativo' : ''}`} onClick={() => setVer(l)}>
                  <td><strong>{l.sala || '—'}</strong>{l.status !== 'ATIVO' && <> <Badge map={STATUS_EQUIP} value={l.status} /></>}</td>
                  <td>{l.hostname || '—'}</td>
                  <td>{l.teamviewer || '—'}</td>
                  {isAdmin && (
                    <td className="acoes" onClick={(e) => e.stopPropagation()}>
                      <button className="icon-btn" title="Editar" onClick={() => setModal(l)}><Pencil size={17} /></button>
                      <button className="icon-btn" title="Excluir" onClick={() => excluir(l)}><Trash2 size={17} color="var(--red)" /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <button className="fab" disabled={!tipoId || precisaUnidade} onClick={() => setModal({})} aria-label="Adicionar beira leito"><Plus size={26} /></button>
      {ver && <EquipamentoDetalhe equip={ver} onClose={() => setVer(null)} />}
      {modal && (
        <LeitoForm leito={modal.id ? modal : null} divisao={divisao} tipoId={tipoId} unidadeId={unidadeId}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />
      )}
    </>
  );
}
