import { BookPageGate } from "@/components/booking/BookPageGate";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { Container } from "@/components/luxury/Container";

export default function BookPage() {
  return (
    <Container className="py-14 md:py-20">
      <header className="mx-auto max-w-3xl text-center">
        <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
          Private Appointments
        </p>
        <h1 className="font-display mt-4 text-4xl text-ink md:text-5xl">
          Reserve an Appointment
        </h1>
        <p className="font-body mx-auto mt-4 max-w-xl text-sm leading-relaxed text-taupe">
          A calm, one-on-one grooming experience reserved exclusively for your
          dog.
        </p>
      </header>

      <BookPageGate>
        <div className="mx-auto mt-10 max-w-2xl">
          <BookingFlow />
        </div>
      </BookPageGate>
    </Container>
  );
}
