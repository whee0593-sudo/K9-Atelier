import { ChargeReceiptLetter } from "@/components/admin/ChargeReceiptLetter";
import { getBrandPublicLinks } from "@/lib/business";
import { formatReceiptPaymentMethod } from "@/lib/charges/receipt-view";
import { buildPreviewCollectContext } from "@/lib/charges/preview";
import { centsToDollars } from "@/lib/referrals/eligible";

export const metadata = {
  title: "Receipt preview · K9 Atelier",
};

export default function CollectReceiptPreviewPage() {
  const context = buildPreviewCollectContext({ paid: true });
  const charge = context.paidCharges[0];
  if (!charge) return null;
  const links = getBrandPublicLinks();

  return (
    <div className="min-h-screen bg-[#F3EEE6] px-4 py-10">
      <p className="mx-auto mb-6 max-w-[560px] rounded-[8px] border border-[#B99A5E] bg-[#FFFDFC] px-4 py-2 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[#766F75]">
        Preview only · paid visit receipt
      </p>
      <ChargeReceiptLetter
        appointment={context.appointment}
        charge={charge}
        paymentMethodLabel={formatReceiptPaymentMethod(context.methods[0])}
        remainingReferralCredit={centsToDollars(
          context.referral?.availableCreditCents ?? 0,
        )}
        websiteUrl={links.websiteUrl}
        instagramUrl={links.instagramUrl}
        googleReviewUrl={links.googleReviewUrl}
      />
    </div>
  );
}
