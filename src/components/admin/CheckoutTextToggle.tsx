export function CheckoutTextToggle({
  checked,
  onChange,
  disabled = false,
  className = "",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-center gap-2 text-sm text-ink ${className}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-gold"
      />
      Send A Check Out Text
    </label>
  );
}
