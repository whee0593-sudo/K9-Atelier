import { formatPrice } from "@/lib/business";
import type { ServiceOption } from "@/lib/services";

type Props = {
  option: ServiceOption;
  selected?: boolean;
  className?: string;
  showPrice?: boolean;
};

export function CreativeOptionDetail({
  option: opt,
  selected = false,
  className = "",
  showPrice = true,
}: Props) {
  const muted = selected ? "text-white/90" : "text-text-muted";
  const gold = selected ? "text-white" : "text-gold-dark";

  return (
    <div className={`text-center ${className}`}>
      <span
        className={`block text-sm font-bold ${
          selected ? "text-white" : "text-text"
        }`}
      >
        {opt.name}
      </span>
      {opt.description && (
        <span className={`mt-2 block text-xs leading-relaxed ${muted}`}>
          {opt.description}
        </span>
      )}
      {opt.note && (
        <span className={`mt-2 block text-xs font-medium ${gold}`}>
          {opt.note}
        </span>
      )}
      {showPrice && (
        <span className={`mt-2 block text-sm font-medium ${gold}`}>
          {opt.consultationRequired
            ? "Consultation required"
            : opt.priceFrom != null
              ? `${formatPrice(opt.priceFrom)}+`
              : "—"}
        </span>
      )}
    </div>
  );
}
