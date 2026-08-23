import { CustomerRecordsPanel } from "@/components/admin/CustomerRecordsPanel";

export default async function AdminPetsPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const query = await searchParams;
  return (
    <div>
      <h2 className="text-2xl font-semibold text-gold-dark">Customers & Pets</h2>
      <p className="mt-2 text-sm text-text-muted">
        Edit owner profiles, pet records, and internal service notes. Open a
        customer to see past appointment dates and paid orders.
      </p>
      <div className="mt-8">
        <CustomerRecordsPanel focusCustomerId={query.customer} />
      </div>
    </div>
  );
}
