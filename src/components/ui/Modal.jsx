import React, { useEffect, useId, useRef, useCallback } from 'react';
import { GiCancel } from 'react-icons/gi';
import Button from './Button';

const FOCUSABLE =
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * A real dialog. The app had four hand-rolled overlays — none with
 * role="dialog", none with a focus trap, and one rendering a "CLOSE [ESC]"
 * button with no keydown listener anywhere in the file.
 *
 * Handles: focus trap, focus restore, Escape, backdrop click, body scroll lock.
 */
const Modal = ({ open, onClose, title, footer, size = 'md', labelledBy, children }) => {
    const panelRef = useRef(null);
    const restoreRef = useRef(null);
    const titleId = useId();

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose?.();
                return;
            }
            if (e.key !== 'Tab' || !panelRef.current) return;

            const nodes = Array.from(panelRef.current.querySelectorAll(FOCUSABLE)).filter(
                (n) => n.offsetParent !== null
            );
            if (nodes.length === 0) return;

            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        },
        [onClose]
    );

    useEffect(() => {
        if (!open) return undefined;

        restoreRef.current = document.activeElement;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const raf = requestAnimationFrame(() => {
            const target =
                panelRef.current?.querySelector(FOCUSABLE) || panelRef.current;
            target?.focus?.();
        });

        return () => {
            cancelAnimationFrame(raf);
            document.body.style.overflow = prevOverflow;
            restoreRef.current?.focus?.();
        };
    }, [open]);

    if (!open) return null;

    return (
        <div
            className="modal__backdrop"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose?.();
            }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy || (title ? titleId : undefined)}
                aria-label={!title && !labelledBy ? 'Dialog' : undefined}
                tabIndex={-1}
                className={[
                    'modal__panel',
                    size === 'wide' ? 'modal__panel--wide' : '',
                    size === 'full' ? 'modal__panel--full' : '',
                ]
                    .filter(Boolean)
                    .join(' ')}
                onKeyDown={handleKeyDown}
            >
                {title && (
                    <header className="modal__header">
                        <h2 id={titleId} className="modal__title">
                            {title}
                        </h2>
                        <Button icon size="sm" label="Close" onClick={onClose}>
                            <GiCancel />
                        </Button>
                    </header>
                )}
                {children}
                {footer && <footer className="modal__footer">{footer}</footer>}
            </div>
        </div>
    );
};

export default Modal;
