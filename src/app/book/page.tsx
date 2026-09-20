import { Container } from "@/components/luxury/Container";
import { BookingFlow } from "@/components/booking/BookingFlow";

type Props = {
  searchParams: Promise<{ ref?: string }>;
};

export default async function BookPage({ searchParams }: Props) {
  const { ref } = await searchParams;
  const initialReferralCode = (ref ?? "").trim();

  return (
    <Container className="py-10 md:py-20">
      <header className="mx-auto max-w-3xl text-center">
        <p className="font-body text-[12px] font-medium uppercase tracking-[0.16em] text-taupe">
          Private Appointments
        </p>
        <h1 className="font-display mt-4 text-4xl text-ink md:text-5xl">
          Reserve an Appointment
        </h1>
        <p className="font-body mx-auto mt-4 max-w-xl text-[13px] leading-relaxed text-taupe md:text-sm">
          A calm, one-on-one grooming experience reserved exclusively for your
          dog.
        </p>
      </header>

      <div className="mx-auto mt-10 max-w-2xl">
        <BookingFlow initialReferralCode={initialReferralCode} />
      </div>
    </Container>
  );
}
