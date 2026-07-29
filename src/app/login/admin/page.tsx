import Link from "next/link";

export default function AdminLoginPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold text-gold-dark">Admin Login</h1>
      <p className="mt-6 text-text-muted">
        For K9 Atelier team members. Set up your admin profile, manage customer
        records, send messages and files, and record service notes.
      </p>
      <Link
        href="/admin/profile"
        className="mt-8 inline-block rounded-2xl bg-gold px-8 py-4 text-lg font-medium text-white transition hover:bg-gold-dark"
      >
        Preview Admin Profile &amp; Dashboard
      </Link>
      <Link
        href="/login"
        className="mt-6 block text-sm text-gold-dark underline"
      >
        Customer login
      </Link>
      <Link href="/" className="mt-4 block text-sm text-text-muted underline">
        Back to Home
      </Link>
    </div>
  );
}
