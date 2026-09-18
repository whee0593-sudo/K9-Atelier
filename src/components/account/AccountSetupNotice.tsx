import Link from "next/link";
import { ACCOUNT_SETUP_PATH, paymentSetupHref } from "@/lib/account-setup";

export function AccountSetupNotice({
  step,
}: {
  step: "pets" | "payment";
}) {
  const body =
    step === "pets"
      ? "Confirm your dog’s rabies vaccination status. You may also add a card on file, and you may upload a rabies certificate or vaccination record. You are not charged now."
      : "You may save a card for after the visit. This is optional. You are not charged now.";

  return (
    <div className="rounded-xl border border-gold/40 bg-lavender-light/40 px-4 py-3 text-sm text-text">
      <p>{body}</p>
      <p className="mt-2">
        <Link href={ACCOUNT_SETUP_PATH} className="font-medium text-gold-dark underline">
          Back to profile checklist
        </Link>
        {step === "pets" ? (
          <>
            {" · "}
            <Link href={paymentSetupHref()} className="font-medium text-gold-dark underline">
              Next: payment method
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
