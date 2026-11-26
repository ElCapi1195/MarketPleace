'use client';

import { useId, type ReactNode } from 'react';

export const control = 'w-full rounded-xl border-2 border-ink/30 bg-background px-3 font-medium';

interface FieldProps {
  label: string;
  hint?: string | undefined;
  wide?: boolean;
  children: (props: { id: string; 'aria-describedby': string | undefined }) => ReactNode;
}

export function LabeledField({ label, hint, wide = false, children }: FieldProps) {
  const id = useId();
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <label htmlFor={id} className="font-bold">
        {label}
      </label>
      {children({ id, 'aria-describedby': hint ? `${id}-hint` : undefined })}
      {hint && (
        <p id={`${id}-hint`} className="text-sm">
          {hint}
        </p>
      )}
    </div>
  );
}

interface CommonProps {
  label: string;
  value: string;
  hint?: string;
  wide?: boolean;
  onChange: (value: string) => void;
}

export function TextField({ label, value, hint, wide, onChange, ...input }: CommonProps & { type?: string; inputMode?: 'decimal' | 'numeric'; maxLength?: number; placeholder?: string }) {
  return (
    <LabeledField label={label} hint={hint} wide={wide ?? false}>
      {(props) => <input {...props} {...input} value={value} onChange={(event) => onChange(event.target.value)} className={`${control} h-12`} />}
    </LabeledField>
  );
}

export function TextArea({ label, value, hint, wide, onChange, maxLength }: CommonProps & { maxLength: number }) {
  return (
    <LabeledField label={label} hint={hint} wide={wide ?? false}>
      {(props) => <textarea {...props} rows={5} maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)} className={`${control} py-2.5`} />}
    </LabeledField>
  );
}

interface SelectProps extends CommonProps {
  options: readonly { value: string; label: string }[];
  placeholder?: string;
}

export function SelectField({ label, value, hint, wide, onChange, options, placeholder }: SelectProps) {
  return (
    <LabeledField label={label} hint={hint} wide={wide ?? false}>
      {(props) => (
        <select {...props} value={value} onChange={(event) => onChange(event.target.value)} className={`${control} h-12`}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </LabeledField>
  );
}

export function CheckField({ label, value, onChange }: CommonProps) {
  return (
    <label className="flex min-h-12 items-center gap-3 self-end font-bold">
      <input type="checkbox" checked={value !== ''} onChange={(event) => onChange(event.target.checked ? 'on' : '')} className="size-5 accent-ink" />
      {label}
    </label>
  );
}
