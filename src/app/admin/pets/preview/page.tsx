import { CustomerRecordsPanel } from "@/components/admin/CustomerRecordsPanel";
import type { StaffCustomerRecord } from "@/lib/profiles/staff-service";

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
];

export default function CustomerRecordsPreviewPage() {
  return (
    <div>
      <p className="mb-4 rounded-xl border border-gold/40 bg-lavender-light/50 px-4 py-2 text-center text-xs uppercase tracking-[0.16em] text-gold-dark">
        Preview only · Freeze and Delete do not change live accounts
      </p>
      <h2 className="text-2xl font-semibold text-gold-dark">
        Registered Accounts
      </h2>
      <p className="mt-2 text-sm text-text-muted">
        Administrators appear first. Only the owner can freeze or delete other
        accounts.
      </p>
      <div className="mt-8">
        <CustomerRecordsPanel preview previewCustomers={previewCustomers} />
      </div>
    </div>
  );
}
