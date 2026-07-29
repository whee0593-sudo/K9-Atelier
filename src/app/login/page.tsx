import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold text-gold-dark">Login</h1>
      <p className="mt-6 text-text-muted">
        Choose how you would like to sign in.
      </p>

      <div className="mt-10 space-y-4">
        <Link
          href="/account"
          className="flex min-h-[4rem] flex-col items-center justify-center rounded-2xl bg-gold px-8 py-4 text-lg font-medium text-white transition hover:bg-gold-dark"
        >
          Customer Login
          <span className="mt-1 text-sm font-normal opacity-90">
            Preview my account
          </span>
        </Link>
        <Link
          href="/login/admin"
          className="flex min-h-[4rem] flex-col items-center justify-center rounded-2xl border-2 border-gold bg-cream px-8 py-4 text-lg font-medium text-gold-dark transition hover:bg-lavender-light"
        >
          Admin Login
          <span className="mt-1 text-sm font-normal text-text-muted">
            K9 Atelier team only
          </span>
        </Link>
      </div>

      <Link
        href="/book"
        className="mt-8 block text-sm text-gold-dark underline"
      >
        Book without an account
      </Link>
      <Link href="/" className="mt-4 block text-sm text-text-muted underline">
        Back to Home
      </Link>
    </div>
  );
}
