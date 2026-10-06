"use client";

import React, { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { BookForCustomerForm } from "@/components/admin/BookForCustomerForm";
import { CustomerRecordsPanel } from "@/components/admin/CustomerRecordsPanel";
import type { StaffBookingProfile } from "@/lib/staff/customer-booking-profile";
import type { StaffCustomerRecord } from "@/lib/profiles/staff-service";
import type { StaffCustomerHistory } from "@/lib/charges/history";
import type { StaffReferralView } from "@/components/admin/StaffCustomerReferrals";

type Prefill = {
  customerId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
};

function FoldSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const panelId = useId();
  return (
    <section className="overflow-hidden rounded-2xl border border-lavender/30 bg-cream">
      <h2 className="m-0">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span className="text-2xl font-semibold text-gold-dark">{title}</span>
          <span
            aria-hidden
            className="min-w-6 text-center text-xl leading-none text-gold-dark"
          >
            {open ? "−" : "+"}
          </span>
        </button>
      </h2>
      {open ? (
        <div id={panelId} className="border-t border-lavender/30 px-5 py-6">
          {children}
        </div>
      ) : (
        <div id={panelId} hidden />
      )}
    </section>
  );
}

export function BookForCustomerSections({
  prefill,
  preview = false,
  initialProfile = null,
  initialDate,
  showPreviewLink = false,
  formInitiallyOpen = false,
  previewCustomers,
  previewHistoryByCustomerId,
  previewReferralsByCustomerId,
  initialSlotStartMinutes,
  initialScheduleDays,
}: {
  prefill?: Prefill;
  preview?: boolean;
  initialProfile?: StaffBookingProfile | null;
  initialDate?: string;
  showPreviewLink?: boolean;
  /** Open the new-customer form when staff arrived from a customer or calendar link. */
  formInitiallyOpen?: boolean;
  previewCustomers?: StaffCustomerRecord[];
  previewHistoryByCustomerId?: Record<string, StaffCustomerHistory>;
  previewReferralsByCustomerId?: Record<string, StaffReferralView>;
  initialSlotStartMinutes?: number | null;
  initialScheduleDays?: Array<{
    date: string;
    available: boolean;
    slots: number[];
    conflicts?: Record<string, string>;
  }> | null;
}) {
  const [onFileOpen, setOnFileOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(formInitiallyOpen);

  return (
    <div className="space-y-4">
      <FoldSection
        title="Book for customer on file"
        open={onFileOpen}
        onToggle={() => setOnFileOpen((value) => !value)}
      >
        <CustomerRecordsPanel
          customersOnly
          preview={preview}
          previewCustomers={previewCustomers}
          previewHistoryByCustomerId={previewHistoryByCustomerId}
          previewReferralsByCustomerId={previewReferralsByCustomerId}
        />
      </FoldSection>
      <FoldSection
        title="Book for a new customer"
        open={formOpen}
        onToggle={() => setFormOpen((value) => !value)}
      >
        <p className="text-sm text-text-muted">
          Email or phone is enough to send a booking link. The customer can
          complete the rest online.
        </p>
        {showPreviewLink ? (
          <p className="mt-2">
            <Link
              href="/admin/book-for-customer/preview"
              className="text-sm font-medium text-gold-dark hover:underline"
            >
              Open preview
            </Link>
          </p>
        ) : null}
        <div className="mt-6">
          <BookForCustomerForm
            preview={preview}
            prefill={prefill}
            initialProfile={initialProfile}
            initialDate={initialDate}
            initialSlotStartMinutes={initialSlotStartMinutes}
            initialScheduleDays={initialScheduleDays}
          />
        </div>
      </FoldSection>
    </div>
  );
}
