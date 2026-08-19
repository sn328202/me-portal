import React, { useId } from 'react';

/**
 * Label + control, wired together. `htmlFor` appeared exactly once in the
 * whole app; 69 inputs were named by placeholder alone, which vanishes the
 * moment you type.
 *
 * Renders an <input> by default; pass as="textarea" / as="select", or pass
 * children to wrap an arbitrary control.
 */
const Field = ({
    label,
    hint,
    error,
    as = 'input',
    className = '',
    children,
    id: idProp,
    ...rest
}) => {
    const autoId = useId();
    const id = idProp || autoId;
    const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
        .filter(Boolean)
        .join(' ');

    const controlClass = as === 'textarea' ? 'textarea' : as === 'select' ? 'select' : 'input';
    const Control = as;

    return (
        <div className={['field', className].filter(Boolean).join(' ')}>
            {label && (
                <label className="field__label" htmlFor={id}>
                    {label}
                </label>
            )}
            {children ? (
                React.isValidElement(children)
                    ? React.cloneElement(children, { id, 'aria-describedby': describedBy || undefined })
                    : children
            ) : (
                <Control
                    id={id}
                    className={controlClass}
                    aria-describedby={describedBy || undefined}
                    aria-invalid={error ? 'true' : undefined}
                    {...rest}
                />
            )}
            {hint && (
                <span id={`${id}-hint`} className="field__hint">
                    {hint}
                </span>
            )}
            {error && (
                <span id={`${id}-error`} className="field__error" role="alert">
                    {error}
                </span>
            )}
        </div>
    );
};

export default Field;
