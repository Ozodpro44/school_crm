import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatNumberWithSpaces, removeNumberFormatting } from "@/lib/utils";

type AmountInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: string | number;
  onChange: (value: string) => void;
};

/**
 * Numeric amount input that live-formats with space thousands separators
 * ("100000" -> "100 000") as the user types, mirroring the pattern
 * settings.tsx already used for monthly payment. onChange receives the
 * plain unformatted digit string (spaces stripped) — callers keep parsing
 * it exactly as they would a native input's value, only the display is
 * formatted.
 */
const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(
  ({ value, onChange, ...props }, ref) => {
    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        value={formatNumberWithSpaces(value ?? "")}
        onChange={(e) => onChange(removeNumberFormatting(e.target.value).replace(/[^\d.]/g, ""))}
      />
    );
  }
);
AmountInput.displayName = "AmountInput";

export { AmountInput };
