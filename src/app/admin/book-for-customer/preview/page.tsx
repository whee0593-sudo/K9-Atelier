import {
  BookForCustomerSections,
  bookingFormStartsOpen,
} from "@/components/admin/BookForCustomerSections";
import type { StaffBookingProfile } from "@/lib/staff/customer-booking-profile";
import type { StaffCustomerRecord } from "@/lib/profiles/staff-service";

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

const previewCustomers: StaffCustomerRecord[] = [
  {
    profile: {
      id: previewProfile.customerId,
      email: previewProfile.email,
      firstName: previewProfile.firstName,
      lastName: previewProfile.lastName,
      phone: previewProfile.phone,
      preferredContact: "Text Message",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelationship: "",
    },
    pets: [],
    paymentMethods: [],
    kind: "customer",
    frozen: false,
    canDelete: false,
    canFreeze: false,
  },
  {
    profile: {
      id: "44444444-4444-4444-8444-444444444444",
      email: "tiafrancavilla@gmail.com",
      firstName: "Tia",
      lastName: "Francavilla",
      phone: "+15613466778",
      preferredContact: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelationship: "",
    },
    pets: [],
    paymentMethods: [],
    kind: "customer",
    frozen: false,
    canDelete: false,
    canFreeze: false,
  },
];

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
      <BookForCustomerSections
        preview
        formInitiallyOpen={bookingFormStartsOpen({ date: query.date })}
        prefill={{
          customerId: previewProfile.customerId,
          firstName: previewProfile.firstName,
          lastName: previewProfile.lastName,
          email: previewProfile.email,
          phone: previewProfile.phone,
        }}
        initialProfile={previewProfile}
        initialDate={query.date}
        previewCustomers={previewCustomers}
      />
    </div>
  );
}
