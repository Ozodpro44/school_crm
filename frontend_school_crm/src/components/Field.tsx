import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type CommonProps = {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
};

type InputProps = CommonProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> & {
    as?: "input";
  };

type TextareaProps = CommonProps &
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
    as: "textarea";
    rows?: number;
  };

type FieldProps = InputProps | TextareaProps;

/**
 * Field — Label + Input/Textarea + inline error message.
 *
 * Usage:
 *   <Field id="email" label="Email" type="email" value={...} onChange={...} error={formErrors.email} required />
 *   <Field id="notes" label="Notes" as="textarea" value={...} onChange={...} />
 */
export function Field(props: FieldProps) {
  const { id, label, error, required, className, as, ...rest } = props as any;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>

      {as === "textarea" ? (
        <Textarea
          id={id}
          required={required}
          aria-invalid={!!error}
          className={cn(error && "border-red-500 focus-visible:ring-red-500")}
          {...rest}
        />
      ) : (
        <Input
          id={id}
          required={required}
          aria-invalid={!!error}
          className={cn(error && "border-red-500 focus-visible:ring-red-500")}
          {...rest}
        />
      )}

      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">{error}</p>
      )}
    </div>
  );
}
