import Link from "next/link";
import { CustomerLoginActions } from "@/components/auth/CustomerLoginActions";
import { Container } from "@/components/luxury/Container";

type Props = {
  searchParams: Promise<{ next?: string; error?: string; mode?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { next, error, mode } = await searchParams;
  const bookingFlow = next === "/book";
  const adminFlow = Boolean(next?.startsWith("/admin"));

  return (
    <Container className="py-14 md:py-20">
      <div className="mx-auto max-w-xl text-center">
        <p className="font-body text-sm font-medium uppercase tracking-[0.18em] text-ink">
          {adminFlow ? "K9 Atelier Team" : "Private Appointments"}
        </p>
        <h1 className="font-display mt-4 text-4xl text-ink md:text-5xl">
          {adminFlow ? "Staff Sign In" : "Welcome to K9 Atelier"}
        </h1>
        <p className="font-body mx-auto mt-6 max-w-md text-sm leading-relaxed text-ink">
          {adminFlow
            ? "Sign in with your team email to review customer records and use admin tools."
            : bookingFlow
              ? "Sign in to continue booking."
              : "Manage your profile, dogs and appointments."}
        </p>

        {error === "auth" && (
          <p
            className="font-body mx-auto mt-6 max-w-md text-sm text-red-700"
            role="alert"
          >
            This email link is invalid or has expired. Please sign in with your email and password.
          </p>
        )}
        {error === "signin-link" && (
          <p
            className="font-body mx-auto mt-6 max-w-md text-sm text-red-700"
            role="alert"
          >
            Email sign-in links are no longer available. Sign in with your
            email and password.
          </p>
        )}
        {error === "frozen" && (
          <p
            className="font-body mx-auto mt-6 max-w-md text-sm text-red-700"
            role="alert"
          >
            Your account has been frozen. Please contact the administrator at
            penny@k9atelier.com
          </p>
        )}

        <CustomerLoginActions
          next={next}
          bookingFlow={bookingFlow}
          adminFlow={adminFlow}
          startWithSignup={mode === "signup"}
        />

        <div className="mt-10 flex items-center justify-center gap-8">
          <Link
            href="/"
            className="font-body text-sm font-medium uppercase tracking-[0.14em] text-ink transition hover:text-ink"
          >
            Return Home
          </Link>
          {adminFlow ? null : (
            <Link
              href="/login?next=/admin"
              className="font-body text-sm font-medium uppercase tracking-[0.14em] text-ink transition hover:text-ink"
            >
              Staff Login
            </Link>
          )}
        </div>
      </div>
    </Container>
  );
}
