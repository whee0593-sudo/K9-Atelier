import Link from "next/link";
import { AdminAccessForm } from "@/components/auth/AdminAccessForm";

export default function AdminLoginPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold text-gold-dark">Team Access</h1>
      <p className="mt-6 text-text-muted">
        The public site is in privacy mode. Enter your team password to preview
        the full website while we prepare for launch.
      </p>

      <div className="mt-8 rounded-2xl border border-lavender/30 bg-cream px-6 py-5 text-left text-sm">
        <p className="font-medium text-gold-dark">Staff account sign-in</p>
        <p className="mt-2 text-text-muted">
          Review vaccinations and use admin tools with your team email (OTP).
        </p>
        <Link
          href="/login?next=/admin"
          className="mt-4 inline-flex items-center rounded-lg bg-gold px-4 py-2 text-sm font-medium text-cream transition hover:bg-gold-dark"
        >
          Staff sign in
        </Link>
      </div>

      <AdminAccessForm />

      <Link
        href="/under-construction"
        className="mt-8 inline-block text-sm text-text-muted underline"
      >
        Back to public page
      </Link>
    </div>
  );
}
