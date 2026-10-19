import { t } from './i18n';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Heart, X, LoaderCircle, Check, ArrowUpRight, ShieldCheck } from 'lucide-react';

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? 'brand-light' : ''}`}>
      <span className="brand-symbol">
        <Heart size={24} strokeWidth={2.2} />
        <Check size={12} className="brand-check" />
      </span>
      <span>
        saathi<span className="brand-dot">.</span>
        <small>{t('CARE, CONNECTED')}</small>
      </span>
    </div>
  );
}
export function Avatar({
  name,
  variant = '',
  size = '',
}: {
  name: string;
  variant?: string;
  size?: string;
}) {
  return (
    <span aria-hidden="true" className={`avatar ${variant} ${size}`}>
      {name
        .split(' ')
        .slice(0, 2)
        .map((x) => x[0])
        .join('')}
    </span>
  );
}
export function Badge({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <ShieldCheck size={26} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={26} />
      <span>{t('Getting your care circle ready…')}</span>
    </div>
  );
}
export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </button>
  );
}
export function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = ref.current!;
    const viewport = window.visualViewport;
    const updateHeight = () => {
      element.style.setProperty('--dialog-viewport-height', `${viewport?.height ?? innerHeight}px`);
    };
    updateHeight();
    viewport?.addEventListener('resize', updateHeight);
    element.showModal();
    return () => {
      viewport?.removeEventListener('resize', updateHeight);
      element.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <div>
          <h2 id={titleId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button className="icon-button" aria-label={t('Close dialog')} onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-track" />
    </label>
  );
}
