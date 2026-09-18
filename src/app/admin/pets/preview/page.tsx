import { CustomerRecordsPanel } from "@/components/admin/CustomerRecordsPanel";
import type { StaffReferralView } from "@/components/admin/StaffCustomerReferrals";
import type { StaffCustomerHistory } from "@/lib/charges/history";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import type { StaffCustomerRecord } from "@/lib/profiles/staff-service";

const TIA_ID = "44444444-4444-4444-8444-444444444444";
const MILO_ID = "55555555-5555-4555-8555-555555555555";

const tiaAppointment: AdminAppointmentRecord = {
  id: "77777777-7777-4777-8777-777777777777",
  customerId: TIA_ID,
  petId: MILO_ID,
  petName: "Milo",
  petBreed: "Yorkie",
  serviceId: "signature-bath-care",
  serviceName: "Signature Bath & Care",
  addOnIds: [],
  addOnOptions: {},
  addressStreet: "2100 S Ocean Blvd",
  addressCity: "Palm Beach",
  addressState: "FL",
  addressZip: "33480",
  travelDistanceMiles: 12,
  travelFee: 13,
  appointmentDate: "2026-09-22",
  appointmentTime: "10–11 AM",
  scheduledStart: 600,
  timePreference: "morning",
  timezone: "America/New_York",
  estimatedTotal: 140,
  newClientDeposit: null,
  vaccinationStatusAtBooking: "needs_review",
  status: "confirmed",
  confirmedAt: "2026-09-18T14:00:00.000Z",
  customerConfirmedAt: null,
  createdAt: "2026-09-18T14:00:00.000Z",
  customerEmail: "tiafrancavilla@gmail.com",
  customerName: null,
  customerFirstName: "",
  customerLastName: "",
  customerPhone: "+15613466778",
  reminderSmsSentAt: null,
  enRouteSmsSentAt: null,
  serviceStartedAt: null,
  serviceEndedAt: null,
};

const previewCustomers: StaffCustomerRecord[] = [
  {
    profile: {
      id: "22222222-2222-4222-8222-222222222222",
      email: "penny@k9atelier.com",
      firstName: "Penny",
      lastName: "K9 Atelier",
      phone: "+15615933335",
      preferredContact: "Email",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelationship: "",
    },
    pets: [],
    paymentMethods: [],
    kind: "admin",
    frozen: false,
    canDelete: false,
    canFreeze: false,
  },
  {
    profile: {
      id: "33333333-3333-4333-8333-333333333333",
      email: "helper@k9atelier.com",
      firstName: "Alex",
      lastName: "Admin",
      phone: "+15615550999",
      preferredContact: "Email",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelationship: "",
    },
    pets: [],
    paymentMethods: [],
    kind: "admin",
    frozen: false,
    canDelete: true,
    canFreeze: true,
  },
  {
    profile: {
      id: "11111111-1111-4111-8111-111111111111",
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      phone: "+15615550123",
      preferredContact: "Text Message",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelationship: "",
    },
    pets: [],
    paymentMethods: [],
    kind: "customer",
    frozen: true,
    canDelete: true,
    canFreeze: true,
  },
  {
    profile: {
      id: TIA_ID,
      email: "tiafrancavilla@gmail.com",
      firstName: "",
      lastName: "",
      phone: "+15613466778",
      preferredContact: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelationship: "",
    },
    pets: [
      {
        id: MILO_ID,
        name: "Milo",
        breed: "Yorkie",
        weightLbs: 8,
        dateOfBirth: "2019-04-12",
        approximateAgeYears: null,
        sex: "Male, Neutered",
        temperamentNotes: "Calm with familiar people.",
        healthComfortNotes: "",
        groomingPreferences: "Face trim, sanitary.",
        createdAt: "2026-09-01T12:00:00.000Z",
        updatedAt: "2026-09-01T12:00:00.000Z",
        adminServiceNotes: "",
        vaccinationBookingStatus: "missing",
        vaccinationHasUpload: false,
      },
    ],
    paymentMethods: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        brand: "visa",
        last4: "4242",
        expMonth: 12,
        expYear: 2028,
        isDefault: true,
      },
    ],
    kind: "customer",
    frozen: false,
    canDelete: true,
    canFreeze: true,
  },
];

const previewHistoryByCustomerId: Record<string, StaffCustomerHistory> = {
  [TIA_ID]: {
    appointments: [tiaAppointment],
    orders: [],
  },
};

const previewReferralsByCustomerId: Record<string, StaffReferralView> = {
  [TIA_ID]: {
    availableCreditCents: 1800,
    availableLabel: "18.00",
    codes: [{ petName: "Milo", code: "MILO-TIA" }],
    rewards: [],
  },
};

export default async function CustomerRecordsPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const query = await searchParams;
  return (
    <div>
      <p className="mb-4 rounded-xl border border-gold/40 bg-lavender-light/50 px-4 py-2 text-center text-xs uppercase tracking-[0.16em] text-gold-dark">
        Preview only · Freeze and Delete do not change live accounts
      </p>
      <h2 className="text-2xl font-semibold text-gold-dark">
        Registered Accounts
      </h2>
      <div className="mt-8">
        <CustomerRecordsPanel
          preview
          previewCustomers={previewCustomers}
          previewHistoryByCustomerId={previewHistoryByCustomerId}
          previewReferralsByCustomerId={previewReferralsByCustomerId}
          focusCustomerId={query.customer ?? TIA_ID}
        />
      </div>
    </div>
  );
}
