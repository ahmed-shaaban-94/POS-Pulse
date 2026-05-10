import { useId, type JSX, type ChangeEvent } from 'react';

type InputVariant = 'text' | 'password' | 'numeric';

interface InputProps {
  variant: InputVariant;
  label: string;
  description?: string;
  errorMessage?: string;
  disabled?: boolean;
  value?: string;
  defaultValue?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function Input({
  variant,
  label,
  description,
  errorMessage,
  disabled = false,
  value,
  defaultValue,
  onChange,
}: InputProps): JSX.Element {
  const id = useId();
  const descId = description ? `${id}-desc` : undefined;
  const errId = errorMessage ? `${id}-err` : undefined;
  const describedBy = [descId, errId].filter(Boolean).join(' ') || undefined;

  const inputType = variant === 'password' ? 'password' : variant === 'numeric' ? 'number' : 'text';

  return (
    <div className="input-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={inputType}
        disabled={disabled}
        aria-invalid={errorMessage ? 'true' : undefined}
        aria-describedby={describedBy}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
      />
      {description && (
        <span id={descId} className="input-field__description">
          {description}
        </span>
      )}
      {errorMessage && (
        <span id={errId} role="alert" className="input-field__error">
          {errorMessage}
        </span>
      )}
    </div>
  );
}
