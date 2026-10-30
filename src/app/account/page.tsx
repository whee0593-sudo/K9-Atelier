import { AccountOverview } from "@/components/account/AccountOverview";
import { listCustomerAppointments } from "@/lib/appointments/service";
import { listPets } from "@/lib/pets/service";

export default async function AccountOverviewPage() {
  const [bookings, pets] = await Promise.all([listCustomerAppointments(), listPets()]);
  if ("error" in bookings || "error" in pets) return <p role="alert">Could not load your overview. Please refresh and try again.</p>;
  return <AccountOverview appointments={bookings.appointments} pets={pets.pets} />;
}
