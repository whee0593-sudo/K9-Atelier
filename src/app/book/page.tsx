import { Container } from "@/components/luxury/Container";
import { BookingFlow } from "@/components/booking/BookingFlow";
import Link from "next/link";
import { viewerCanViewServicePrices } from "@/lib/pricing-access";

type Props = {
  searchParams: Promise<{ ref?: string }>;
};

export default async function BookPage({ searchParams }: Props) {
  const { ref } = await searchParams;
  const initialReferralCode = (ref ?? "").trim();
  const showPrices = await viewerCanViewServicePrices();

  return (
    <Container className="py-10 md:py-20 [&:has([data-booking-confirmed])>header]:hidden">
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="font-display mt-4 text-4xl text-ink md:text-5xl">
          Book Online
        </h1>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm text-ink">
          <span>Prefer to call?</span>
          <Link href="/request-a-call" className="inline-flex min-h-11 items-center justify-center rounded-sm border border-deep-lavender bg-deep-lavender px-5 text-sm font-medium text-white transition-colors hover:bg-[#4C3758] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-deep-lavender">
            Request a call
          </Link>
        </div>
      </header>

      <div className="mx-auto mt-10 max-w-2xl">
        <BookingFlow
          initialReferralCode={initialReferralCode}
          showPrices={showPrices}
        />
      </div>
    </Container>
  );
}
