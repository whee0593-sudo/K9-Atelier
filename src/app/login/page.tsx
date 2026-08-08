import Link from "next/link";
import { CustomerLoginActions } from "@/components/auth/CustomerLoginActions";
import { Container } from "@/components/luxury/Container";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const bookingFlow = next === "/book";

  return (
    <Container className="py-14 md:py-20">
      <div className="mx-auto max-w-xl text-center">
        <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
          Private Appointments
        </p>
        <h1 className="font-display mt-4 text-4xl text-ink md:text-5xl">
          Welcome to K9 Atelier
        </h1>
        <p className="font-body mx-auto mt-6 max-w-md text-sm leading-relaxed text-taupe">
          {bookingFlow
            ? "Sign in to reserve or manage your dog's private grooming appointment."
            : "Sign in to manage your profile, pets, and appointments."}
        </p>

        <CustomerLoginActions next={next} bookingFlow={bookingFlow} />

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
