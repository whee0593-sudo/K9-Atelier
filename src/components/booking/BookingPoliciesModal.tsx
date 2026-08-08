"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { business, formatPrice } from "@/lib/business";
import { bookingSecondaryBtnClass } from "@/components/booking/booking-ui";

type Props = {
  open: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

type SectionId =
  | "payment"
  | "cancellation"
  | "travel"
  | "flea"
  | "special-handling";

const SECTIONS: Array<{ id: SectionId; number: string; title: string }> = [
  { id: "payment", number: "01", title: "Payment & Deposits" },
  { id: "cancellation", number: "02", title: "Cancellation & Rescheduling" },
  { id: "travel", number: "03", title: "Service Area & Travel" },
  { id: "flea", number: "04", title: "Flea & Tick Care" },
  { id: "special-handling", number: "05", title: "Special Handling" },
];

const fleaFee = business.fees.find((fee) => fee.id === "flea-tick-fee");
const fleaLineItems =
  fleaFee && "lineItems" in fleaFee && Array.isArray(fleaFee.lineItems)
    ? (fleaFee.lineItems as Array<{ name: string; rate: number }>)
    : [];
const medicatedRate = fleaLineItems[0]?.rate ?? 20;
const sanitationRate = fleaLineItems[1]?.rate ?? 20;

const behaviorFee = business.fees.find((fee) => fee.id === "behavior-fee");
const behaviorMin =
  behaviorFee && "rateMin" in behaviorFee && typeof behaviorFee.rateMin === "number"
    ? behaviorFee.rateMin
    : 25;
const behaviorMax =
  behaviorFee && "rateMax" in behaviorFee && typeof behaviorFee.rateMax === "number"
    ? behaviorFee.rateMax
    : 50;

function PolicyRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-t border-champagne/15 py-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <p className="font-body text-[10px] font-medium uppercase tracking-[0.14em] text-ink">
        {label}
      </p>
      <p className="font-body text-sm text-taupe sm:text-right">{value}</p>
    </div>
  );
}

function PolicyPriceRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-champagne/15 py-3 first:border-t-0 first:pt-0">
      <p className="font-body text-[10px] font-medium uppercase tracking-[0.14em] text-ink">
        {label}
      </p>
      <p className="font-body shrink-0 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function AccordionPanel({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: SectionId;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const section = SECTIONS.find((item) => item.id === id)!;
  const panelId = `policy-panel-${id}`;
  const headerId = `policy-header-${id}`;

  return (
    <div
      className={`border-b border-champagne/20 transition-colors duration-200 motion-reduce:transition-none ${
        open ? "bg-dusty-lavender/20" : "bg-ivory"
      }`}
    >
      <h3>
        <button
          type="button"
          id={headerId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-h-[44px] w-full items-center gap-4 px-0 py-4 text-left outline-none transition-colors focus-visible:ring-1 focus-visible:ring-champagne/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory"
        >
          <span className="font-body shrink-0 text-[10px] font-medium tracking-[0.16em] text-champagne">
            {section.number}
          </span>
          <span className="min-w-0 flex-1 font-body text-[11px] font-medium uppercase tracking-[0.14em] text-ink">
            {title}
          </span>
          <span
            aria-hidden="true"
            className="font-body shrink-0 text-sm text-champagne"
          >
            {open ? "−" : "+"}
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        hidden={!open}
        className="overflow-hidden pb-5 pl-[calc(1.5rem+0.75rem)] pr-0 text-sm leading-relaxed text-taupe motion-reduce:transition-none sm:pl-[calc(1.75rem+1rem)]"
      >
        {open ? children : null}
      </div>
    </div>
  );
}

export function BookingPoliciesModal({
  open,
  onClose,
  returnFocusRef,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [openSection, setOpenSection] = useState<SectionId | null>(null);

  useEffect(() => {
    if (!open) {
      setOpenSection(null);
      return;
    }

    closeRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    returnFocusRef?.current?.focus();
  }, [open, returnFocusRef]);

  if (!open) return null;

  function toggleSection(id: SectionId) {
    setOpenSection((current) => (current === id ? null : id));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="max-h-[85vh] w-full max-w-[760px] overflow-y-auto rounded-sm border border-gray-line bg-ivory p-5 shadow-sm sm:p-10 lg:p-12"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
          Service Policies
        </p>
        <h2
          id={titleId}
          className="font-display mt-3 text-3xl text-ink sm:text-4xl"
        >
          Policies &amp; Fees
        </h2>
        <p className="font-body mt-3 max-w-xl text-sm leading-relaxed text-taupe">
          Everything you need to know before reserving your K9 Atelier
          appointment.
        </p>

        <div className="mt-8 border-t border-champagne/20">
          <AccordionPanel
            id="payment"
            title="Payment & Deposits"
            open={openSection === "payment"}
            onToggle={() => toggleSection("payment")}
          >
            <div className="space-y-4">
              <p>
                A valid payment method is required to secure every booking.
              </p>
              <div>
                <p className="font-body text-[10px] font-medium uppercase tracking-[0.14em] text-ink">
                  Returning Clients
                </p>
                <p className="mt-2">
                  Payment is settled after your appointment. Returning clients
                  are not charged at the time of booking unless otherwise noted.
                </p>
              </div>
              <div>
                <p className="font-body text-[10px] font-medium uppercase tracking-[0.14em] text-ink">
                  New Clients
                </p>
                <p className="mt-2">
                  A $50 reservation deposit is required to confirm your first
                  appointment.
                </p>
                <p className="mt-2">
                  The deposit is applied in full toward your final service
                  total, with the remaining balance settled after your
                  appointment.
                </p>
              </div>
            </div>
          </AccordionPanel>

          <AccordionPanel
            id="cancellation"
            title="Cancellation & Rescheduling"
            open={openSection === "cancellation"}
            onToggle={() => toggleSection("cancellation")}
          >
            <div className="space-y-4">
              <p>
                Because every K9 Atelier appointment is reserved exclusively for
                one dog, we kindly ask for as much notice as possible if your
                plans change.
              </p>
              <div>
                <PolicyRow
                  label="48+ Hours"
                  value="Complimentary cancellation or rescheduling"
                />
                <PolicyRow
                  label="Less Than 48 Hours"
                  value="50% of the scheduled service price"
                />
                <PolicyRow
                  label="Same-Day Cancellation"
                  value="100% of the scheduled service price"
                />
                <PolicyRow
                  label="No-Show"
                  value="100% of the scheduled service price"
                />
              </div>
              <p>
                If we arrive and are unable to reach you or access your dog
                within 15 minutes of the scheduled appointment time, the
                appointment may be considered a no-show.
              </p>
              <p>
                Genuine health emergencies involving you or your dog will be
                handled with reasonable flexibility.
              </p>
            </div>
          </AccordionPanel>

          <AccordionPanel
            id="travel"
            title="Service Area & Travel"
            open={openSection === "travel"}
            onToggle={() => toggleSection("travel")}
          >
            <div className="space-y-4">
              <p>
                K9 Atelier serves Palm Beach Gardens and surrounding Palm Beach
                communities, including select appointments in West Palm Beach
                and Jupiter.
              </p>
              <p>
                Complimentary travel is provided within our primary 10-mile
                service area.
              </p>
              <p>
                Extended appointments up to approximately 20 miles may be
                accommodated at $6.50 per one-way mile, calculated using GPS
                driving distance.
              </p>
              <p>
                Your applicable travel fee, if any, will be calculated before
                you confirm your appointment.
              </p>
            </div>
          </AccordionPanel>

          <AccordionPanel
            id="flea"
            title="Flea & Tick Care"
            open={openSection === "flea"}
            onToggle={() => toggleSection("flea")}
          >
            <div className="space-y-4">
              <p>
                If fleas or ticks are discovered during the pre-groom
                assessment, treatment and sanitation are required to protect your
                dog and subsequent clients.
              </p>
              <div>
                <PolicyPriceRow
                  label="Medicated Treatment"
                  value={`+${formatPrice(medicatedRate)}`}
                />
                <PolicyPriceRow
                  label="Vehicle Sanitation"
                  value={`+${formatPrice(sanitationRate)}`}
                />
              </div>
            </div>
          </AccordionPanel>

          <AccordionPanel
            id="special-handling"
            title="Special Handling"
            open={openSection === "special-handling"}
            onToggle={() => toggleSection("special-handling")}
          >
            <div className="space-y-4">
              <p>
                If your dog requires additional time or specialized handling due
                to significant anxiety, resistance or aggression, an additional
                handling fee may apply.
              </p>
              <PolicyPriceRow
                label="Additional Handling"
                value={`+${formatPrice(behaviorMin)}–${formatPrice(behaviorMax)}+`}
              />
              <p>
                Whenever possible, we will communicate any additional care
                requirements with you.
              </p>
            </div>
          </AccordionPanel>
        </div>

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className={`${bookingSecondaryBtnClass} mt-8 w-full sm:w-auto`}
        >
          Close
        </button>
      </div>
    </div>
  );
}
