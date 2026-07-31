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
