import Image from "next/image";
import { ChargeReceiptBrandLinks } from "@/components/admin/ChargeReceiptBrandLinks";
import { business } from "@/lib/business";
import { formatChargeMoney } from "@/lib/charges/money";
import {
  formatReceiptDate,
  formatReceiptPaymentDate,
  formatReceiptTime,
  receiptPaymentStatus,
} from "@/lib/charges/receipt-view";
import type { AppointmentChargeRecord } from "@/lib/charges/types";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";

export function ChargeReceiptLetter({
  appointment,
  charge,
  paymentMethodLabel,
  receiptNumber,
  websiteUrl,
  instagramUrl,
  googleReviewUrl,
}: {
  appointment: AdminAppointmentRecord;
  charge: AppointmentChargeRecord;
  paymentMethodLabel?: string | null;
  receiptNumber?: string | null;
  websiteUrl?: string;
  instagramUrl?: string | null;
  googleReviewUrl?: string | null;
}) {
  const petName = appointment.petName?.trim() || null;
  const appointmentDate = formatReceiptDate(appointment.appointmentDate);
  const appointmentTime = formatReceiptTime(appointment.appointmentTime);
  const paymentDate = formatReceiptPaymentDate(
    charge.paidAt,
    appointment.timezone,
  );
  const paymentStatus = receiptPaymentStatus(charge);
  const phone = business.brand.phone?.trim() || null;
  const showAppointment = Boolean(appointmentDate || appointmentTime);
  const showService = charge.lineItems.length > 0 || charge.tipAmount > 0;
  const thankYouBody = petName
    ? `We are truly grateful that you have entrusted ${petName}’s care to K9 Atelier.`
    : "We are truly grateful for choosing K9 Atelier.";

  return (
    <article className="mx-auto w-full max-w-[560px] overflow-hidden rounded-[8px] bg-[#FFFDFC] shadow-[0_8px_28px_rgba(47,41,48,0.06)]">
      <div className="h-px bg-[#756578]" aria-hidden />
      <div className="px-5 py-10 sm:px-8">
        <header className="text-center">
          <Image
            src={business.brand.logo}
            alt={business.brand.name}
            width={72}
            height={72}
            className="mx-auto"
          />
          <h1 className="font-display mt-4 text-[22px] font-normal tracking-[0.18em] text-[#756578] sm:text-2xl">
            {business.brand.name}
          </h1>
          <p className="font-body mt-3 text-[12px] font-medium uppercase tracking-[0.16em] text-[#756578]">
            Private Mobile Pet SPA
          </p>
          <p className="font-body mt-1 text-[12px] font-medium uppercase tracking-[0.16em] text-[#756578]">
            Palm Beach
          </p>
        </header>

        <div className="mt-10 space-y-8 text-left font-body text-base leading-[1.6] text-[#2F2930]">
          <p>{thankYouBody}</p>

          {showAppointment ? (
            <section>
              <SectionLabel>Appointment</SectionLabel>
              {appointmentDate ? (
                <p className="mt-3 text-[#2F2930]">{appointmentDate}</p>
              ) : null}
              {appointmentTime ? (
                <p className="mt-1 text-[#2F2930]">{appointmentTime}</p>
              ) : null}
            </section>
          ) : null}

          {petName ? (
            <section>
              <SectionLabel>Pet</SectionLabel>
              <p className="mt-3 text-[#2F2930]">{petName}</p>
            </section>
          ) : null}

          {showService ? (
            <section>
              <SectionLabel>Service summary</SectionLabel>
              <ul className="mt-3 space-y-2">
                {charge.lineItems.map((item) => (
                  <MoneyRow key={item.id} label={item.label} amount={item.amount} />
                ))}
                {charge.tipAmount > 0 ? (
                  <MoneyRow label="Gratuity" amount={charge.tipAmount} />
                ) : null}
              </ul>
            </section>
          ) : null}

          <section>
            <div className="border-y border-[#E7DED2] py-4">
              <MoneyRow
                label="TOTAL PAID"
                amount={charge.total}
                emphasize
              />
            </div>
            {paymentStatus ? (
              <p className="mt-4 flex items-center gap-2 text-base text-[#766F75]">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-[#756578]"
                  aria-hidden
                />
                Payment status: {paymentStatus}
              </p>
            ) : null}
          </section>

          {receiptNumber || paymentDate || paymentMethodLabel ? (
            <section className="space-y-2 text-base leading-[1.6] text-[#766F75]">
              {receiptNumber ? <p>Receipt number: {receiptNumber}</p> : null}
              {paymentDate ? <p>Payment date: {paymentDate}</p> : null}
              {paymentMethodLabel ? (
                <p>Payment method: {paymentMethodLabel}</p>
              ) : null}
            </section>
          ) : null}
        </div>

        <footer className="mt-12 text-center">
          <p className="font-display text-xl tracking-[0.18em] text-[#2F2930]">
            K9 ATELIER
          </p>
          {phone ? (
            <p className="mt-3 font-body text-base text-[#766F75]">{phone}</p>
          ) : null}
          <ChargeReceiptBrandLinks
            appointmentId={appointment.id}
            chargeId={charge.id}
            websiteUrl={websiteUrl}
            instagramUrl={instagramUrl}
            googleReviewUrl={googleReviewUrl}
          />
        </footer>
      </div>
    </article>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <h2 className="font-body text-[11px] font-medium uppercase tracking-[0.18em] text-[#756578]">
      {children}
    </h2>
  );
}

function MoneyRow({
  label,
  amount,
  emphasize = false,
}: {
  label: string;
  amount: number;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 ${
        emphasize
          ? "font-body text-lg text-[#2F2930]"
          : "font-body text-base text-[#2F2930]"
      }`}
    >
      <span className="min-w-0 break-words">{label}</span>
      <span className="whitespace-nowrap text-right tabular-nums">
        {formatChargeMoney(amount)}
      </span>
    </div>
  );
}

