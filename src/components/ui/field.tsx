import { forwardRef } from "react";
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const fieldStyles =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/30 disabled:cursor-not-allowed disabled:opacity-60";

export interface FieldProps {
  label?: string;
  hint?: string;
  required?: boolean;
  error?: string;
}

function FieldShell({
  label,
  hint,
  required,
  error,
  children,
}: FieldProps & { children: ReactNode }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 flex items-center gap-1 text-sm font-semibold text-slate-700">
          {label}
          {required && <span className="text-royal-600">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & FieldProps
>(({ className, label, hint, required, error, ...props }, ref) => (
  <FieldShell label={label} hint={hint} required={required} error={error}>
    <input
      ref={ref}
      required={required}
      aria-invalid={!!error}
      className={cn(fieldStyles, error && "border-red-400 focus:ring-red-400/30", className)}
      {...props}
    />
  </FieldShell>
));
Input.displayName = "Input";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & FieldProps
>(({ className, label, hint, required, error, children, ...props }, ref) => (
  <FieldShell label={label} hint={hint} required={required} error={error}>
    <select
      ref={ref}
      required={required}
      className={cn(fieldStyles, "appearance-none pr-9", className)}
      {...props}
    >
      {children}
    </select>
  </FieldShell>
));
Select.displayName = "Select";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps
>(({ className, label, hint, required, error, ...props }, ref) => (
  <FieldShell label={label} hint={hint} required={required} error={error}>
    <textarea
      ref={ref}
      required={required}
      className={cn(fieldStyles, "min-h-24 resize-y", className)}
      {...props}
    />
  </FieldShell>
));
Textarea.displayName = "Textarea";