"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { CANCELLATION_POLICY_ROWS } from "@/lib/appointments/policy-copy";
import { business, formatPrice } from "@/lib/business";
import { bookingSecondaryBtnClass } from "@/components/booking/booking-ui";

export type BookingPolicySectionId =
  | "payment"
  | "cancellation"
  | "rescheduling"
  | "incomplete-service"
  | "travel"
  | "flea"
  | "special-handling";

type Props = {
  open: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  initialSection?: BookingPolicySectionId;
  showPrices?: boolean;
  includeConsentPolicies?: boolean;
};

const SECTIONS: Array<{
  id: BookingPolicySectionId;
  number: string;
  title: string;
}> = [
  { id: "payment", number: "01", title: "Payment" },
  { id: "cancellation", number: "02", title: "Cancellation" },
  { id: "rescheduling", number: "03", title: "Rescheduling" },
  { id: "incomplete-service", number: "04", title: "Incomplete Service" },
  { id: "travel", number: "05", title: "Service Area & Travel" },
  { id: "flea", number: "06", title: "Flea & Tick Care" },
  { id: "special-handling", number: "07", title: "Additional Fee" },
];

const policyCopy = business.booking.policyModalCopy;

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

function PolicyRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-t border-champagne/15 py-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <p className="font-body text-[12px] font-medium uppercase tracking-[0.14em] text-ink">
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
      <p className="font-body text-[12px] font-medium uppercase tracking-[0.14em] text-ink">
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
  id: BookingPolicySectionId;
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
          <span className="font-body shrink-0 text-[12px] font-medium tracking-[0.16em] text-champagne">
            {section.number}
          </span>
          <span className="min-w-0 flex-1 font-body text-[12px] font-medium uppercase tracking-[0.14em] text-ink">
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
        className="overflow-hidden px-1 pb-5 text-left text-sm leading-relaxed text-taupe motion-reduce:transition-none"
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
  initialSection,
  showPrices = false,
  includeConsentPolicies = false,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [openSection, setOpenSection] = useState<BookingPolicySectionId | null>(
    initialSection ?? null,
  );

  useEffect(() => {
    if (!open) {
      setOpenSection(null);
      return;
    }
    setOpenSection(initialSection ?? null);

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
  }, [open, onClose, initialSection]);

  useEffect(() => {
    if (open) return;
    returnFocusRef?.current?.focus();
  }, [open, returnFocusRef]);

  if (!open) return null;

  function toggleSection(id: BookingPolicySectionId) {
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
        <p className="font-body text-center text-[12px] font-medium uppercase tracking-[0.18em] text-taupe">
          Service Policies
        </p>
        <h2
          id={titleId}
          className="font-display mt-3 text-center text-3xl text-ink sm:text-4xl"
        >
          Policies &amp; Fees
        </h2>

        <div className="mt-8 border-t border-champagne/20">
          <AccordionPanel
            id="payment"
            title="Payment"
            open={openSection === "payment"}
            onToggle={() => toggleSection("payment")}
          >
            <div className="space-y-3">
              {policyCopy.payment.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </AccordionPanel>

          <AccordionPanel
            id="cancellation"
            title="Cancellation"
            open={openSection === "cancellation"}
            onToggle={() => toggleSection("cancellation")}
          >
            <div className="space-y-4">
              <p>{policyCopy.cancellation.calendar}</p>
              <div>
                {CANCELLATION_POLICY_ROWS.map(([label, value]) => (
                  <PolicyRow key={label} label={label} value={value} />
                ))}
              </div>
              <details>
                <summary className="cursor-pointer font-medium text-ink">Fee details &amp; exceptions</summary>
                <div className="mt-3 space-y-3">
                  <p>{policyCopy.cancellation.basis}</p>
                  <p>{policyCopy.cancellation.noShow}</p>
                </div>
              </details>
              <p>{policyCopy.cancellation.contact}</p>
            </div>
          </AccordionPanel>

          <AccordionPanel
            id="rescheduling"
            title="Rescheduling"
            open={openSection === "rescheduling"}
            onToggle={() => toggleSection("rescheduling")}
          >
            <div className="space-y-3">
              <p>{policyCopy.rescheduling}</p>
              <button type="button" onClick={() => {
                setOpenSection("cancellation");
                document.getElementById("policy-header-cancellation")?.focus();
              }} className="font-medium text-ink underline underline-offset-4">
                View cancellation fees
              </button>
            </div>
          </AccordionPanel>

          <AccordionPanel
            id="incomplete-service"
            title="Incomplete Service"
            open={openSection === "incomplete-service"}
            onToggle={() => toggleSection("incomplete-service")}
          >
            <div className="space-y-4">
              {policyCopy.incompleteService.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
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
                K9 Atelier Mobile Pet Spa serves Jupiter Island, Jupiter,
                Tequesta, Palm Beach Gardens, and Palm Beach.
              </p>
              <PolicyRow label={`Within ${business.serviceArea.freeRadiusMiles} driving miles`} value="Travel included" />
              {showPrices ? (
                <div>
                  <PolicyRow
                    label={`Over ${business.serviceArea.freeRadiusMiles}–${business.serviceArea.maxDistanceMiles} miles`}
                    value={`${formatPrice(business.serviceArea.travelFeePerMile)}/mile beyond ${business.serviceArea.freeRadiusMiles}`}
                  />
                  <PolicyRow
                    label={`Over ${business.serviceArea.maxDistanceMiles}–${business.serviceArea.standardServiceMiles} miles`}
                    value={`${formatPrice((business.serviceArea.maxDistanceMiles - business.serviceArea.freeRadiusMiles) * business.serviceArea.travelFeePerMile)} + ${formatPrice(business.serviceArea.extendedTravelFeePerMile)}/mile beyond ${business.serviceArea.maxDistanceMiles}`}
                  />
                  <p className="mt-2">Based on one-way driving distance, rounded to the nearest dollar.</p>
                </div>
              ) : (
                <p>Your travel fee, if any, is shown on Review & Confirm.</p>
              )}
              <p>
                Beyond {business.serviceArea.standardServiceMiles} miles, please
                contact us.
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
              <p>{policyCopy.flea}</p>
              {showPrices ? (
                <div>
                  <PolicyPriceRow
                    label="Medicated Treatment"
                    value={`From ${formatPrice(medicatedRate)}`}
                  />
                  <PolicyPriceRow
                    label="Vehicle Sanitation"
                    value={`From ${formatPrice(sanitationRate)}`}
                  />
                </div>
              ) : null}
            </div>
          </AccordionPanel>

          <AccordionPanel
            id="special-handling"
            title="Additional Fee"
            open={openSection === "special-handling"}
            onToggle={() => toggleSection("special-handling")}
          >
            <div className="space-y-4">
              <p>{policyCopy.additionalFee}</p>
              {showPrices ? (
                <div className="mx-auto max-w-sm text-left">
                  <PolicyPriceRow
                    label="Dematting Fee"
                    value={`From ${formatPrice(30)}`}
                  />
                  <PolicyPriceRow
                    label="Special Handling"
                    value={`From ${formatPrice(behaviorMin)}`}
                  />
                </div>
              ) : null}
            </div>
          </AccordionPanel>
        </div>

        {includeConsentPolicies ? <div className="font-body mt-6 space-y-4 text-sm text-taupe">
          <h3 className="font-medium text-ink">Photo policy</h3>
          <p>{business.booking.photoMarketingConsent}</p>
          <h3 className="font-medium text-ink">Text-message policies</h3>
          <p>Review our <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline">SMS terms and opt-out instructions</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</a>.</p>
        </div> : null}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className={`${bookingSecondaryBtnClass} mx-auto mt-8 block w-full sm:w-auto`}
        >
          Close
        </button>
      </div>
    </div>
  );
}
