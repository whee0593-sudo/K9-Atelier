import Link from "next/link";
import { ACCOUNT_SETUP_PATH, paymentSetupHref } from "@/lib/account-setup";

export function AccountSetupNotice({
  step,
}: {
  step: "pets" | "payment";
}) {
  const body =
    step === "pets"
      ? "Upload a current rabies certificate or vaccination record, then add a card on file. You are not charged now."
      : "Save a card on file for after the visit. You are not charged now.";

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
