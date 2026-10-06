export function bookingFormStartsOpen(query: {
  customerId?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  date?: string;
}) {
  return Boolean(
    query.customerId ||
      query.email ||
      query.phone ||
      query.firstName ||
      query.lastName ||
      (query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date)),
  );
}
