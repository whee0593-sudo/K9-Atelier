import { formatPrice } from "@/lib/business";
import { coloringOptionDisplayNote } from "@/lib/service-page";
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
  const note = showPrice ? opt.note : coloringOptionDisplayNote(opt.note);

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
      {note ? (
        <span className={`mt-2 block text-xs font-medium ${gold}`}>
          {note}
        </span>
      ) : null}
      {showPrice && (
        <span className={`mt-2 block text-sm font-medium ${gold}`}>
          {opt.consultationRequired
            ? "Consultation required"
            : opt.priceFrom != null
              ? `From ${formatPrice(opt.priceFrom)}`
              : "—"}
        </span>
      )}
    </div>
  );
}
