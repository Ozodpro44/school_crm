import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatPhoneAsYouType } from "@/lib/utils";

type PhoneInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (value: string) => void;
};

/**
 * Phone number input that live-formats to "+998 (91) 123-45-68" as the user
 * types. The formatted string (not raw digits) is what's passed to onChange
 * and submitted — matching how phone numbers are already displayed
 * everywhere else via formatPhoneNumber (lib/utils.ts), so a value coming
 * back from the API round-trips through this input unchanged.
 */
const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, ...props }, ref) => {
    return (
      <Input
        {...props}
        ref={ref}
        type="tel"
        inputMode="tel"
        placeholder={props.placeholder ?? "+998 (91) 123-45-68"}
        value={value}
        onChange={(e) => onChange(formatPhoneAsYouType(e.target.value))}
      />
    );
  }
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
