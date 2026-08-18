import { CustomerRecordsPanel } from "@/components/admin/CustomerRecordsPanel";

export default function AdminPetsPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-gold-dark">Customers & Pets</h2>
      <p className="mt-2 text-sm text-text-muted">
        Edit owner profiles, pet records, and internal service notes. Payment
        methods are shown for reference and are managed by the customer.
      </p>
      <div className="mt-8">
        <CustomerRecordsPanel />
      </div>
    </div>
  );
}
