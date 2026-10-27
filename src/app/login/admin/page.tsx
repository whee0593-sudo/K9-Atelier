import Link from "next/link";
import { business } from "@/lib/business";
import { isPrivacyGateActive } from "@/lib/site-access";
import { AdminAccessForm } from "@/components/auth/AdminAccessForm";

export default function AdminLoginPage() {
  const privacyMode = isPrivacyGateActive(business.site?.privacyMode === true);
  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold text-gold-dark">Team Access</h1>
      <p className="mt-6 text-text-muted">
        {privacyMode
          ? "Enter your team password to preview the website."
          : "Sign in with your staff account to manage the atelier."}
      </p>

      <div className="mt-8 rounded-2xl border border-lavender/30 bg-cream px-6 py-5 text-left text-sm">
        <p className="font-medium text-gold-dark">Staff account sign-in</p>
        <p className="mt-2 text-text-muted">
          Review customer records and use admin tools with your team email and
          password.
        </p>
        <Link
          href="/login?next=/admin"
          className="mt-4 inline-flex items-center rounded-lg bg-gold px-4 py-2 text-sm font-medium text-cream transition hover:bg-gold-dark"
        >
          Staff sign in
        </Link>
      </div>

      {privacyMode ? <AdminAccessForm /> : null}

      <Link
        href={privacyMode ? "/under-construction" : "/"}
        className="mt-8 inline-block text-sm text-text-muted underline"
      >
        {privacyMode ? "Back to public page" : "View website"}
      </Link>
    </div>
  );
}
