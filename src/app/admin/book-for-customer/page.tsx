import Link from "next/link";
import { BookForCustomerForm } from "@/components/admin/BookForCustomerForm";

export default async function BookForCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }>;
}) {
  const query = await searchParams;
  return (
    <div>
      <h2 className="text-2xl font-semibold text-gold-dark">
        Book for a customer
      </h2>
      <p className="mt-2">
        <Link
          href="/admin/book-for-customer/preview"
          className="text-sm font-medium text-gold-dark hover:underline"
        >
          Open preview
        </Link>
      </p>
      <div className="mt-8">
        <BookForCustomerForm
          prefill={{
            email: query.email,
            firstName: query.firstName,
            lastName: query.lastName,
            phone: query.phone,
          }}
        />
      </div>
    </div>
  );
}
