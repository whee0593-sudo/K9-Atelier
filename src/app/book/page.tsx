import { Container } from "@/components/luxury/Container";
import { BookingFlow } from "@/components/booking/BookingFlow";
import Link from "next/link";

type Props = {
  searchParams: Promise<{ ref?: string }>;
};

export default async function BookPage({ searchParams }: Props) {
  const { ref } = await searchParams;
  const initialReferralCode = (ref ?? "").trim();

  return (
    <Container className="py-10 md:py-20">
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="font-display mt-4 text-4xl text-ink md:text-5xl">
          Book Online
        </h1>
        <p className="font-body mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink">
          Save your card securely with Stripe. No charge today.
        </p>
        <Link href="/request-a-call" className="mt-3 inline-flex min-h-11 items-center text-sm text-deep-lavender underline underline-offset-4">Prefer to talk? Request a Call</Link>
      </header>

      <div className="mx-auto mt-10 max-w-2xl">
        <BookingFlow initialReferralCode={initialReferralCode} />
      </div>
    </Container>
  );
}
