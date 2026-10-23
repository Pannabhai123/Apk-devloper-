import type { ReactNode } from 'react';
import { useEffect } from 'react';

interface Props {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
}

export default function Modal({ title, children, onClose, closeLabel }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && onClose) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal">
        <h3>{title}</h3>
        {children}
        {onClose && (
          <div className="btn-row mt">
            <button className="btn btn-ghost" onClick={onClose}>{closeLabel ?? 'बंद करें / Close'}</button>
          </div>
        )}
      </div>
    </div>
  );
}
