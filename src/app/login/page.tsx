import Link from "next/link";
import { CustomerLoginActions } from "@/components/auth/CustomerLoginActions";
import { Container } from "@/components/luxury/Container";

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams;
  const bookingFlow = next === "/book";
  const adminFlow = Boolean(next?.startsWith("/admin"));

  return (
    <Container className="py-14 md:py-20">
      <div className="mx-auto max-w-xl text-center">
        <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
          {adminFlow ? "K9 Atelier Team" : "Private Appointments"}
        </p>
        <h1 className="font-display mt-4 text-4xl text-ink md:text-5xl">
          {adminFlow ? "Staff Sign In" : "Welcome to K9 Atelier"}
        </h1>
        <p className="font-body mx-auto mt-6 max-w-md text-sm leading-relaxed text-taupe">
          {adminFlow
            ? "Sign in with your team email to review vaccinations and use admin tools."
            : bookingFlow
              ? "Sign in with your email and password to reserve or manage your dog's private grooming appointment."
              : "Sign in with your email and password to manage your profile, pets, and appointments."}
        </p>

        {error === "auth" && (
          <p
            className="font-body mx-auto mt-6 max-w-md text-sm text-red-700"
            role="alert"
          >
            This email link only works in the browser that requested it. On
            your phone, request a new reset and enter the 6-digit code.
          </p>
        )}

        <CustomerLoginActions
          next={next}
          bookingFlow={bookingFlow}
          adminFlow={adminFlow}
          startWithReset={error === "auth"}
        />

        <Link
          href="/"
          className="font-body mt-10 inline-block text-[10px] font-medium uppercase tracking-[0.14em] text-taupe transition hover:text-ink"
        >
          Return Home
        </Link>
      </div>
    </Container>
  );
}
