import { ConfirmAccountForm } from "@/components/account/ConfirmAccountForm";
import { Container } from "@/components/luxury/Container";

export default function ConfirmAccountPreviewPage() {
  return (
    <Container className="py-14 md:py-20">
      <div className="mx-auto max-w-xl">
        <p className="mb-6 rounded-xl border border-gold/40 bg-lavender-light/50 px-4 py-2 text-center text-xs uppercase tracking-[0.16em] text-gold-dark">
          Preview only · Confirm does not change a live booking
        </p>
        <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
          Appointment
        </p>
        <h1 className="font-display mt-4 text-4xl text-ink md:text-5xl">
          Confirm your visit
        </h1>
        <ConfirmAccountForm
          token="preview"
          preview={{
            requiresPassword: true,
            customer: {
              email: "ada@example.com",
              firstName: "Ada",
            },
            appointment: {
              id: "11111111-1111-4111-8111-111111111111",
              customerId: "22222222-2222-4222-8222-222222222222",
              petId: "33333333-3333-4333-8333-333333333333",
              petName: "Bella",
              petBreed: "Poodle",
              serviceId: "signature-bath-care",
              serviceName: "Signature Bath & Care",
              addOnIds: [],
              addOnOptions: {},
              addressStreet: "100 Olive Ave",
              addressCity: "West Palm Beach",
              addressState: "FL",
              addressZip: "33401",
              travelDistanceMiles: 4,
              travelFee: 0,
              appointmentDate: "2026-09-18",
              appointmentTime: "10–11 AM",
              scheduledStart: 600,
              timePreference: "morning",
              timezone: "America/New_York",
              estimatedTotal: 95,
              newClientDeposit: 0,
              vaccinationStatusAtBooking: "missing",
              status: "pending_confirmation",
              confirmedAt: null,
              customerConfirmedAt: null,
              staffCreated: true,
              awaitingCustomerConfirm: true,
              createdAt: "2026-09-13T12:00:00.000Z",
            },
          }}
        />
      </div>
    </Container>
  );
}
