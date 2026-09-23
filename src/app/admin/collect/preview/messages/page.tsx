import { buildPreviewCollectContext } from "@/lib/charges/preview";
import {
  buildAfterVisitThankYouSms,
  buildChargeReceiptEmail,
} from "@/lib/charges/receipts";
import {
  buildNextDayFollowUpEmail,
  buildNextDayFollowUpSms,
} from "@/lib/followup/copy";

export default function ReceiptMessagePreviewPage() {
  const context = buildPreviewCollectContext({ paid: true });
  const charge = context.paidCharges[0];
  if (!charge) return null;

  const email = buildChargeReceiptEmail(context.appointment, charge);
  const thankYouSms = buildAfterVisitThankYouSms(context.appointment);
  const followUp = {
    firstName: context.appointment.customerFirstName,
    petName: context.appointment.petName,
  };
  const followUpEmail = buildNextDayFollowUpEmail(followUp);
  const followUpSms = buildNextDayFollowUpSms(followUp);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-10">
      <p className="rounded-[8px] border border-[#B99A5E] bg-[#FFFDFC] px-4 py-2 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[#766F75]">
        Preview only · sample guest messages
      </p>

      <section>
        <h1 className="font-display text-3xl text-[#2F2930]">Thank-you text</h1>
        <div className="mx-auto mt-6 max-w-sm rounded-[28px] border border-[#E7DED2] bg-[#F3EEE6] px-4 py-6">
          <p className="text-center text-[11px] uppercase tracking-[0.14em] text-[#766F75]">
            Messages
          </p>
          <div className="mt-4 whitespace-pre-wrap rounded-[18px] rounded-bl-md bg-white px-4 py-3 text-[15px] leading-[1.5] break-words text-[#2F2930] shadow-[0_4px_16px_rgba(47,41,48,0.06)]">
            {thankYouSms}
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-display text-3xl text-[#2F2930]">Next-day follow-up text</h2>
        <div className="mx-auto mt-6 max-w-sm rounded-[28px] border border-[#E7DED2] bg-[#F3EEE6] px-4 py-6">
          <p className="text-center text-[11px] uppercase tracking-[0.14em] text-[#766F75]">
            Messages
          </p>
          <div className="mt-4 whitespace-pre-wrap rounded-[18px] rounded-bl-md bg-white px-4 py-3 text-[15px] leading-[1.5] break-words text-[#2F2930] shadow-[0_4px_16px_rgba(47,41,48,0.06)]">
            {followUpSms}
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-display text-3xl text-[#2F2930]">Next-day follow-up email</h2>
        <div className="mt-6 overflow-hidden rounded-[8px] border border-[#E7DED2] bg-[#FAF6EF]">
          <iframe
            title="Next-day follow-up email"
            srcDoc={followUpEmail.html}
            className="h-[760px] w-full border-0 bg-[#FAF6EF]"
          />
        </div>
      </section>

      <section>
        <h2 className="font-display text-3xl text-[#2F2930]">Email receipt</h2>
        <div className="mt-6 overflow-hidden rounded-[8px] border border-[#E7DED2] bg-[#FAF6EF]">
          <iframe
            title="Customer receipt email"
            srcDoc={email.html}
            className="h-[760px] w-full border-0 bg-[#FAF6EF]"
          />
        </div>
      </section>
    </div>
  );
}
