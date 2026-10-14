import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Badge, Modal } from '../../components/ui';
import { STATUS_EQUIP, nomeEquip } from '../../utils/format';

const Item = ({ label, children }) => (
  <div><dt>{label}</dt><dd>{children || '—'}</dd></div>
);

// Ficha do equipamento: visível para todos os perfis (somente leitura)
export default function EquipamentoDetalhe({ equip: e, onClose, inline }) {
  const mono = { fontFamily: 'ui-monospace, Consolas, monospace' };
  const ref = useRef(null);
  const [copiado, setCopiado] = useState(false);
  const copiar = () => {
    navigator.clipboard?.writeText(e.link_drivers).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500); }).catch(() => {});
  };
  // Inline: leva a tela até a ficha, que fica em cima da lista
  useEffect(() => { if (inline) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [inline, e.id]);

  const corpo = (
    <>
      <p className="muted" style={{ marginBottom: '1rem' }}>
        {e.categoria} · {e.tipo} <span style={{ marginLeft: '.5rem' }}><Badge map={STATUS_EQUIP} value={e.status} /></span>
      </p>

      <dl className="info-grid">
        <Item label="Local">
          {[e.setor_nome, e.sala].filter(Boolean).join(' · ')}
        </Item>
        <Item label="Unidade">{e.unidade_nome}</Item>

        {e.nome && <Item label="Nome do painel">{e.nome}</Item>}
        {e.hostname && <Item label="Hostname"><span style={mono}>{e.hostname}</span></Item>}
        {e.teamviewer && <Item label="ID TeamViewer / AnyDesk"><span style={mono}>{e.teamviewer}</span></Item>}
        {e.teamviewer && <Item label="Senha de acesso"><span style={mono}>{e.teamviewer_senha}</span></Item>}

        {e.exibe_ip && <Item label="Endereço IP"><span style={mono}>{e.ip}</span></Item>}
        {(e.numero_serie || e.categoria === 'Impressoras') && <Item label="Número de série"><span style={mono}>{e.numero_serie}</span></Item>}
        {e.fabricante && <Item label="Marca">{e.fabricante}</Item>}
        {e.modelo && <Item label="Modelo">{e.modelo}</Item>}
        {e.patrimonio && <Item label="Patrimônio">{e.patrimonio}</Item>}

        {e.ligado_a_id && (
          <Item label="Conectada ao computador">{e.ligado_a_hostname || e.ligado_a_patrimonio}</Item>
        )}
        {e.impressoras?.length > 0 && (
          <Item label="Impressoras conectadas">
            {e.impressoras.map((i) => [i.tipo, i.modelo].filter(Boolean).join(' ')).join(', ')}
          </Item>
        )}
        {(e.link_drivers || e.categoria === 'Impressoras') && (
          <Item label="Drivers">
            {!e.link_drivers ? <span className="muted">Link ainda não cadastrado pelo administrador</span>
              : /^https?:\/\//i.test(e.link_drivers)
                ? <a href={e.link_drivers} target="_blank" rel="noreferrer">Abrir pasta de drivers</a>
                : (
                  <span>
                    <span style={mono}>{e.link_drivers}</span>{' '}
                    <button type="button" className="btn btn-sm" onClick={copiar}>{copiado ? 'Copiado!' : 'Copiar'}</button>
                  </span>
                )}
          </Item>
        )}
        {e.observacoes && <Item label="Observações">{e.observacoes}</Item>}
      </dl>

    </>
  );

  if (!inline) return <Modal title={nomeEquip(e)} onClose={onClose}>{corpo}</Modal>;
  return (
    <div className="card ficha-inline" ref={ref}>
      <div className="ficha-topo">
        <h2>{nomeEquip(e)}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
      </div>
      {corpo}
    </div>
  );
}
