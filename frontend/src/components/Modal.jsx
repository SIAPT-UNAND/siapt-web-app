import { useId } from 'react';

export default function Modal({ isOpen, title, children, onClose, size = 'md' }) {
  const titleId = useId();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-container modal-${size}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-header">
          <h3 id={titleId} className="modal-title">{title}</h3>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Tutup Modal"
            type="button"
          >
            &times;
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
