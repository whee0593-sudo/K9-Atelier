import {
  BookForCustomerSections,
  bookingFormStartsOpen,
} from "@/components/admin/BookForCustomerSections";

export default async function BookForCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{
    customerId?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    date?: string;
  }>;
}) {
  const query = await searchParams;
  return (
    <BookForCustomerSections
      showPreviewLink
      formInitiallyOpen={bookingFormStartsOpen(query)}
      prefill={{
        customerId: query.customerId,
        email: query.email,
        firstName: query.firstName,
        lastName: query.lastName,
        phone: query.phone,
      }}
      initialDate={query.date}
    />
  );
}
