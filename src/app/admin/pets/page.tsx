import Link from "next/link";
import { CustomerRecordsPanel } from "@/components/admin/CustomerRecordsPanel";

export default async function AdminPetsPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const query = await searchParams;
  return (
    <div>
      <h2 className="text-2xl font-semibold text-gold-dark">
        Registered Accounts
      </h2>
      <p className="mt-2 text-sm text-text-muted">
        Administrators are listed first, then customers. The owner can freeze
        or delete any account except their own. Other admins can still edit
        customer profiles and pets.
      </p>
      <p className="mt-2">
        <Link
          href="/admin/pets/preview"
          className="text-sm font-medium text-gold-dark hover:underline"
        >
          Open preview
        </Link>
      </p>
      <div className="mt-8">
        <CustomerRecordsPanel focusCustomerId={query.customer} />
      </div>
    </div>
  );
}
