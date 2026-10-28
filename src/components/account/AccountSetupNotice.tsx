import React from "react";
import Link from "next/link";
import { ACCOUNT_SETUP_PATH } from "@/lib/account-setup";

export function AccountSetupNotice(_props: { step: "pets" | "payment" }) {
  return <div className="rounded-xl border border-gold/40 bg-lavender-light/40 px-4 py-3 text-sm text-text">
    <p>Manage your saved payment methods. You will not be charged when adding a card.</p>
    <p className="mt-2"><Link href={ACCOUNT_SETUP_PATH} className="font-medium text-gold-dark underline">Back to profile setup</Link></p>
  </div>;
}
