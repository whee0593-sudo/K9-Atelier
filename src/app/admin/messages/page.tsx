import Link from "next/link";
import { AdminMessageComposer } from "@/components/admin/AdminMessageComposer";

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; phone?: string }>;
}) {
  const params = await searchParams;
  return (
    <div>
      <h2 className="text-2xl font-semibold text-gold-dark">
        Contact Customer
      </h2>
      <p className="mt-2">
        <Link
          href="/admin/messages/preview"
          className="text-sm font-medium text-gold-dark hover:underline"
        >
          Open preview
        </Link>
      </p>
      <div className="mt-8">
        <AdminMessageComposer
          initialCustomerId={params.customer ?? ""}
          initialPhone={params.phone ?? ""}
        />
      </div>
    </div>
  );
}
