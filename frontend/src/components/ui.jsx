import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, X } from 'lucide-react';
import { percentual } from '../utils/format';

export function Badge({ map, value }) {
  const [label, tone] = map[value] || [value, 'gray'];
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

export function Progress({ feitas, total }) {
  const pct = percentual(feitas, total);
  return (
    <div className="progress" title={`${feitas} de ${total} atividades`}>
      <div className="progress-bar"><div style={{ width: `${pct}%` }} className={pct === 100 ? 'done' : ''} /></div>
      <span>{feitas}/{total}</span>
    </div>
  );
}

export function PageHeader({ title, subtitle, back, children }) {
  return (
    <header className="page-header">
      <div>
        {back && <Link to={back} className="back"><ArrowLeft size={16} /> Voltar</Link>}
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      <div className="actions">{children}</div>
    </header>
  );
}

export function Modal({ title, onClose, wide, children }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export const Field = ({ label, required, hint, children, className = '' }) => (
  <label className={`field ${className}`}>
    <span>{label}{required && <b className="req"> *</b>}</span>
    {children}
    {hint && <small className="muted">{hint}</small>}
  </label>
);

export const SearchBox = ({ value, onChange, placeholder = 'Buscar…' }) => (
  <div className="search">
    <Search size={16} />
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

export const Loading = () => <div className="state">Carregando…</div>;
export const ErrorMsg = ({ children }) => (children ? <div className="alert alert-error">{children}</div> : null);
export const Empty = ({ children = 'Nenhum registro encontrado.' }) => <div className="state">{children}</div>;

// Opções <option> a partir de uma lista
export const Options = ({ items, value = 'id', label = 'nome', vazio }) => (
  <>
    {vazio !== undefined && <option value="">{vazio}</option>}
    {(items || []).map((i) => <option key={i[value]} value={i[value]}>{i[label]}</option>)}
  </>
);

// Rodapé padrão de formulários em modal
export function FormActions({ onCancel, saving, disabled, label = 'Salvar' }) {
  return (
    <div className="form-actions">
      <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
      <button type="submit" className="btn btn-primary" disabled={saving || disabled}>{saving ? 'Salvando…' : label}</button>
    </div>
  );
}
