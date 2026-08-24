import { buildPreviewOnTheWayAppointments } from "@/lib/appointments/calendar-preview";
import type { AppointmentRecord } from "@/lib/appointments/types";
import {
  buildCustomerAddDogEmail,
  buildCustomerCancelEmail,
  buildCustomerRemoveDogEmail,
  buildCustomerRescheduleEmail,
} from "@/lib/email/html-templates";
import type { CancelFeeStatus } from "@/lib/email/cancel-confirmation";
import type { CancelPaymentFailureKind } from "@/lib/email/cancel-fee-failed";

const SAMPLE_CONTACT = {
  email: "alex@example.com",
  name: "Alex Rivera",
  firstName: "Alex",
};

function EmailPreview({
  title,
  note,
  subject,
  html,
  narrow = false,
}: {
  title: string;
  note: string;
  subject: string;
  html: string;
  narrow?: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-3xl text-[#2F2930]">{title}</h2>
      <p className="font-body text-sm text-[#766F75]">{note}</p>
      <p className="font-body text-sm text-[#2F2930]">
        Subject: {subject}
      </p>
      <div
        className={`overflow-hidden rounded-[8px] border border-[#E7DED2] bg-[#F8F4ED] ${
          narrow ? "mx-auto max-w-[390px]" : ""
        }`}
      >
        <iframe
          title={title}
          srcDoc={html}
          className="h-[920px] w-full border-0 bg-[#F8F4ED]"
        />
      </div>
    </section>
  );
}

function cancelPreview(
  appointment: AppointmentRecord,
  options: {
    title: string;
    note: string;
    petNames?: string[];
    fee?: number;
    feeStatus?: CancelFeeStatus;
    cardBrand?: string | null;
    cardLast4?: string | null;
    paymentFailureKind?: CancelPaymentFailureKind | null;
    willAutoRetry?: boolean;
    paymentUpdateUrl?: string | null;
    customer?: typeof SAMPLE_CONTACT;
    narrow?: boolean;
  },
) {
  const email = buildCustomerCancelEmail({
    appointment,
    customer: options.customer ?? SAMPLE_CONTACT,
    petNames: options.petNames,
    fee: options.fee,
    feeStatus: options.feeStatus,
    cardBrand: options.cardBrand,
    cardLast4: options.cardLast4,
    paymentFailureKind: options.paymentFailureKind,
    willAutoRetry: options.willAutoRetry,
    paymentUpdateUrl: options.paymentUpdateUrl,
  });
  return (
    <EmailPreview
      title={options.title}
      note={options.note}
      subject={email.subject}
      html={email.html}
      narrow={options.narrow}
    />
  );
}

export default function AppointmentChangeEmailPreviewPage() {
  const [maple, otto] = buildPreviewOnTheWayAppointments();
  if (!maple || !otto) return null;

  const rescheduled = {
    ...maple,
    appointmentDate: "2026-08-26",
    appointmentTime: "10:00–12:00 PM",
  };
  const reschedule = buildCustomerRescheduleEmail({
    appointment: rescheduled,
    customer: SAMPLE_CONTACT,
    petNames: [maple.petName, otto.petName],
    serviceLabels: [
      `${maple.petName} · ${maple.serviceName}`,
      `${otto.petName} · ${otto.serviceName}`,
    ],
    fee: 70,
  });
  const add = buildCustomerAddDogEmail({
    appointment: { ...otto, appointmentDate: maple.appointmentDate },
    customer: SAMPLE_CONTACT,
  });
  const daisyVisit = {
    ...maple,
    petName: "Daisy",
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-12">
      <p className="rounded-[8px] border border-[#B99A5E] bg-[#FFFDFC] px-4 py-2 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[#766F75]">
        Preview only · sample change confirmation emails
      </p>

      <EmailPreview
        title="Reschedule"
        note="Sent after the guest confirms a new date and time. Sample fee is a late-change charge for Maple and Otto."
        subject={reschedule.subject}
        html={reschedule.html}
      />

      {cancelPreview(maple, {
        title: "Cancel · one pet, fee charged",
        note: "Single pet, successful cancellation fee, card brand and last four from the payment method on file.",
        petNames: [maple.petName],
        fee: 70,
        feeStatus: "paid",
        cardBrand: "visa",
        cardLast4: "4242",
      })}
      {cancelPreview(maple, {
        title: "Cancel · two pets, fee charged",
        note: "Maple and Otto with a successful cancellation fee.",
        petNames: [maple.petName, otto.petName],
        fee: 182.5,
        feeStatus: "paid",
        cardBrand: "mastercard",
        cardLast4: "8210",
      })}
      {cancelPreview(maple, {
        title: "Cancel · three pets",
        note: "Natural list for Maple, Otto, and Daisy.",
        petNames: [maple.petName, otto.petName, daisyVisit.petName],
        fee: 0,
        feeStatus: "none",
      })}
      {cancelPreview(maple, {
        title: "Cancel · fee processing",
        note: "Fee exists but is still processing. Must not say it has been charged.",
        petNames: [maple.petName],
        fee: 70,
        feeStatus: "processing",
      })}
      {cancelPreview(maple, {
        title: "Cancel · charge failed, morning",
        note: "Failed cancellation fee. Morning window shows AM on both sides. Primary button updates the card on file.",
        petNames: [maple.petName],
        fee: 70,
        feeStatus: "failed",
        paymentFailureKind: "declined",
      })}
      {cancelPreview(
        { ...maple, appointmentTime: "1:00–3:00 PM" },
        {
          title: "Cancel · charge failed, afternoon",
          note: "Afternoon window: 1:00 PM–3:00 PM.",
          petNames: [maple.petName],
          fee: 70,
          feeStatus: "failed",
          paymentFailureKind: "expired",
        },
      )}
      {cancelPreview(
        { ...maple, appointmentTime: "11:00–1:00 PM" },
        {
          title: "Cancel · charge failed, crosses noon",
          note: "11:00 AM–1:00 PM with two pets.",
          petNames: [maple.petName, otto.petName],
          fee: 182.5,
          feeStatus: "failed",
        },
      )}
      {cancelPreview(
        { ...maple, appointmentTime: "11:00 PM–1:00 AM" },
        {
          title: "Cancel · charge failed, crosses midnight",
          note: "11:00 PM–1:00 AM. Unknown failure reason.",
          petNames: [maple.petName],
          fee: 70,
          feeStatus: "failed",
        },
      )}
      {cancelPreview(maple, {
        title: "Cancel · charge failed, auto-retry",
        note: "System will retry. Guest is not told to update the card unless it changed.",
        petNames: [maple.petName],
        fee: 70,
        feeStatus: "failed",
        willAutoRetry: true,
      })}
      {cancelPreview(maple, {
        title: "Cancel · charge failed, no payment page",
        note: "If the secure payment-update URL is missing, Contact K9 ATELIER becomes the primary button.",
        petNames: [maple.petName],
        fee: 70,
        feeStatus: "failed",
        paymentUpdateUrl: null,
      })}
      {cancelPreview(
        {
          ...maple,
          petName: "Bartholomew Maximilian-Whitfield",
          appointmentTime: "10:00–12:00 PM",
        },
        {
          title: "Cancel · charge failed, mobile width",
          note: "Narrow 390px frame for the failed-fee letter.",
          petNames: ["Bartholomew Maximilian-Whitfield"],
          fee: 140,
          feeStatus: "failed",
          customer: {
            email: "guest@example.com",
            name: "Anastasia Montgomery-Whitfield",
            firstName: "Anastasia Montgomery-Whitfield",
          },
          narrow: true,
        },
      )}
      {cancelPreview(maple, {
        title: "Cancel · no fee",
        note: "Complimentary cancellation. No $0.00 and no empty fee block.",
        petNames: [maple.petName],
        fee: 0,
        feeStatus: "none",
      })}
      {cancelPreview(
        { ...maple, appointmentTime: "" },
        {
          title: "Cancel · no appointment time",
          note: "Time row is omitted entirely when the appointment has no time.",
          petNames: [maple.petName],
          fee: 0,
        },
      )}
      {cancelPreview(
        {
          ...maple,
          petName: "Bartholomew Maximilian-Whitfield",
        },
        {
          title: "Cancel · long names, mobile width",
          note: "Narrow 390px frame to check wrapping on a phone-sized card.",
          petNames: ["Bartholomew Maximilian-Whitfield"],
          fee: 140,
          feeStatus: "paid",
          cardBrand: "amex",
          cardLast4: "1005",
          customer: {
            email: "guest@example.com",
            name: "Anastasia Montgomery-Whitfield",
            firstName: "Anastasia Montgomery-Whitfield",
          },
          narrow: true,
        },
      )}

      {(() => {
        const removePreviews = [
          {
            title: "Remove a dog · two pets, one removed",
            note: "Sent after a client removes one pet from a multi-pet appointment. Remaining visit unchanged.",
            remaining: [otto],
            fee: 70,
            feeStatus: "paid" as const,
            cardBrand: "visa",
            cardLast4: "4242",
          },
          {
            title: "Remove a dog · three pets, one removed",
            note: "Maple removed; Otto and Daisy remain confirmed.",
            remaining: [otto, daisyVisit],
            fee: 0,
            feeStatus: "none" as const,
          },
          {
            title: "Remove a dog · fee processing",
            note: "Fee exists but is still processing.",
            remaining: [otto],
            fee: 70,
            feeStatus: "processing" as const,
          },
          {
            title: "Remove a dog · charge failed",
            note: "Fee exists but the charge failed.",
            remaining: [otto],
            fee: 70,
            feeStatus: "failed" as const,
          },
          {
            title: "Remove a dog · no fee",
            note: "Complimentary removal. No $0.00 and no charged copy.",
            remaining: [otto],
            fee: 0,
            feeStatus: "none" as const,
          },
          {
            title: "Remove a dog · remaining visit updated",
            note: "Remaining appointment time and total changed, so the unchanged sentence is hidden.",
            remaining: [
              {
                ...otto,
                appointmentTime: "1:00–3:00 PM",
                estimatedTotal: 210,
              },
            ],
            remainingUpdated: true,
            fee: 70,
            feeStatus: "paid" as const,
          },
        ];
        return removePreviews.map((preview) => {
          const email = buildCustomerRemoveDogEmail({
            appointment: maple,
            customer: SAMPLE_CONTACT,
            remainingAppointments: preview.remaining,
            remainingUpdated: preview.remainingUpdated,
            manageAppointmentId: preview.remaining[0]?.id,
            fee: preview.fee,
            feeStatus: preview.feeStatus,
            cardBrand: preview.cardBrand,
            cardLast4: preview.cardLast4,
          });
          return (
            <EmailPreview
              key={preview.title}
              title={preview.title}
              note={preview.note}
              subject={email.subject}
              html={email.html}
            />
          );
        });
      })()}
      {(() => {
        const email = buildCustomerRemoveDogEmail({
          appointment: {
            ...maple,
            petName: "Bartholomew Maximilian-Whitfield",
          },
          customer: {
            email: "guest@example.com",
            name: "Anastasia Montgomery-Whitfield",
            firstName: "Anastasia Montgomery-Whitfield",
          },
          remainingAppointments: [
            { ...otto, petName: "Lady Clementine-Rose" },
          ],
          manageAppointmentId: otto.id,
          fee: 0,
        });
        return (
          <EmailPreview
            title="Remove a dog · long names, mobile width"
            note="Narrow 390px frame to check wrapping on a phone-sized card."
            subject={email.subject}
            html={email.html}
            narrow
          />
        );
      })()}

      <EmailPreview
        title="Add a dog"
        note="Sent after the guest asks to add another pet. The request stays pending until you confirm."
        subject={add.subject}
        html={add.html}
      />
    </div>
  );
}
