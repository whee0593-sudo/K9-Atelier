import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold text-gold-dark">Login</h1>
      <p className="mt-6 text-text-muted">
        Sign in to manage your profile, pets, addresses, and payment methods.
        Customer login is coming soon.
      </p>
      <Link
        href="/account"
        className="mt-8 inline-block rounded-2xl bg-gold px-8 py-4 text-lg font-medium text-white transition hover:bg-gold-dark"
      >
        Preview My Account
      </Link>
      <Link
        href="/book"
        className="mt-4 block text-sm text-gold-dark underline"
      >
        Book without an account
      </Link>
      <Link href="/" className="mt-4 block text-sm text-text-muted underline">
        Back to Home
      </Link>
    </div>
  );
}
