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
        <small>CARE, CONNECTED</small>
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
      <span>Getting your care circle ready…</span>
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
    element.showModal();
    return () => element.close();
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
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
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
export function GardenIllustration() {
  return (
    <div className="garden" aria-hidden="true">
      <div className="garden-orbit one" />
      <div className="garden-orbit two" />
      <span className="garden-person p1">M</span>
      <span className="garden-person p2">A</span>
      <span className="garden-person p3">L</span>
      <div className="garden-heart">
        <Heart size={44} fill="currentColor" strokeWidth={1.2} />
        <span>
          <Check size={18} />
        </span>
      </div>
      <svg viewBox="0 0 180 90" className="garden-leaves">
        <path
          d="M90 90Q82 42 25 22M90 90Q110 35 160 12"
          fill="none"
          stroke="#82a993"
          strokeWidth="2"
        />
        <path
          d="M40 31Q5 37 9 8Q39 4 40 31ZM64 50Q29 58 32 28Q64 24 64 50ZM119 42Q116 8 145 8Q152 31 119 42ZM101 67Q108 37 137 46Q134 74 101 67Z"
          fill="#a9c2a8"
        />
      </svg>
    </div>
  );
}
