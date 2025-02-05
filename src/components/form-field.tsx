import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface FormFieldProps {
  id: string;
  label: string;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  showPassword?: boolean;
  onShowPasswordChange?: (show: boolean) => void;
}

export function FormField({
  id,
  label,
  placeholder,
  type = "text",
  disabled,
  value,
  onChange,
  error,
  showPassword,
  onShowPasswordChange,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        name={id}
        placeholder={placeholder}
        type={type}
        disabled={disabled}
        value={value}
        onChange={onChange}
        className={error ? "border-red-500" : ""}
        showPassword={showPassword}
        onShowPasswordChange={onShowPasswordChange}
      />
      {error && <span className="text-sm text-red-500">{error}</span>}
    </div>
  );
}
