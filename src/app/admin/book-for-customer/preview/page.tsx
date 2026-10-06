import { BookForCustomerForm } from "@/components/admin/BookForCustomerForm";
import type { StaffBookingProfile } from "@/lib/staff/customer-booking-profile";

const previewProfile: StaffBookingProfile = {
  customerId: "11111111-1111-4111-8111-111111111111",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: "+15615550123",
  pets: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Luna",
      breed: "Poodle",
      weightLbs: 14.5,
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Max",
      breed: "Maltese",
      weightLbs: 11,
    },
  ],
  addresses: [
    {
      street: "10 Main St",
      city: "Palm Beach",
      state: "FL",
      zip: "33480",
    },
    {
      street: "20 Ocean Ave",
      city: "Palm Beach",
      state: "FL",
      zip: "33480",
    },
  ],
};

export default async function BookForCustomerPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const query = await searchParams;
  return (
    <div>
      <p className="mb-4 rounded-xl border border-gold/40 bg-lavender-light/50 px-4 py-2 text-center text-xs uppercase tracking-[0.16em] text-gold-dark">
        Preview only · Sample customer file · Submit does not create a live account
      </p>
      <h2 className="text-2xl font-semibold text-gold-dark">
        Book for a customer
      </h2>
      <div className="mt-8">
        <BookForCustomerForm
          preview
          prefill={{
            customerId: previewProfile.customerId,
            firstName: previewProfile.firstName,
            lastName: previewProfile.lastName,
            email: previewProfile.email,
            phone: previewProfile.phone,
          }}
          initialProfile={previewProfile}
          initialDate={query.date}
        />
      </div>
    </div>
  );
}
