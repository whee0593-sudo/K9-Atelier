import { business } from "@/lib/business";
import {
  buildChargeReceiptParagraphs,
  chargeReceiptGreeting,
} from "@/lib/charges/receipt-content";
import type { AppointmentChargeRecord } from "@/lib/charges/types";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";

export function ChargeReceiptLetter({
  appointment,
  charge,
}: {
  appointment: AdminAppointmentRecord;
  charge: AppointmentChargeRecord;
}) {
  const greeting = chargeReceiptGreeting(appointment);
  const paragraphs = buildChargeReceiptParagraphs(appointment, charge);
  const footer = [
    business.brand.name,
    business.brand.phone,
    business.brand.email,
    "k9atelier.com",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="mx-auto max-w-[480px] border border-[#E8E0D3] bg-white font-[Georgia,'Times_New_Roman',serif] text-[#3A3226]">
      <header className="border-b border-[#B08D57] bg-[#FAF6EF] px-8 py-8 text-center">
        <img
          src={business.brand.logo}
          alt={business.brand.name}
          width={64}
          height={64}
          className="mx-auto mb-3 rounded-full"
        />
        <p className="text-xl tracking-[0.25em] text-[#3A3226]">K9 ATELIER</p>
      </header>
      <div className="bg-white px-8 py-7 text-sm leading-[1.8]">
        <p className="mb-3.5">Dear {greeting},</p>
        {paragraphs.map((paragraph, index) => (
          <p key={`${index}-${paragraph}`} className="mb-3.5 last:mb-0">
            {paragraph}
          </p>
        ))}
      </div>
      <footer className="bg-[#FAF6EF] px-8 py-5 text-center text-[11px] tracking-wide text-[#8A8073]">
        {footer}
      </footer>
    </article>
  );
}
