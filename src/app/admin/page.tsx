import Link from "next/link";
import { isOwnerUser } from "@/lib/staff/auth";

export default async function AdminDashboardPage() {
  const showTeam = await isOwnerUser();
  return (
    <div>
      <h2 className="text-2xl font-semibold text-gold-dark">Dashboard</h2>
      <p className="mt-2 text-sm text-text-muted">
        Manage customer profiles, pet records, appointments, and messages.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/appointments"
          className="rounded-2xl border border-lavender/30 bg-cream p-6 transition hover:border-gold/40"
        >
          <h3 className="font-medium text-gold-dark">Calendar</h3>
          <p className="mt-2 text-sm text-text-muted">
            Click any day to see bookings. Gray days are past or full; white
            days still have room.
          </p>
        </Link>
        <Link
          href="/admin/vaccinations"
          className="rounded-2xl border border-lavender/30 bg-cream p-6 transition hover:border-gold/40"
        >
          <h3 className="font-medium text-gold-dark">Vaccination Review</h3>
          <p className="mt-2 text-sm text-text-muted">
            Approve or reject customer vaccination uploads before confirming
            pending appointments.
          </p>
        </Link>
        <Link
          href="/admin/finance"
          className="rounded-2xl border border-lavender/30 bg-cream p-6 transition hover:border-gold/40"
        >
          <h3 className="font-medium text-gold-dark">Finance</h3>
          <p className="mt-2 text-sm text-text-muted">
            Daily, weekly, quarterly, and yearly revenue. Service, tips, and
            tax are listed separately, plus how often each service was sold.
          </p>
        </Link>
        <Link
          href="/admin/messages"
          className="rounded-2xl border border-lavender/30 bg-cream p-6 transition hover:border-gold/40"
        >
          <h3 className="font-medium text-gold-dark">Customer Messages</h3>
          <p className="mt-2 text-sm text-text-muted">
            Send messages and files to a customer&apos;s account inbox.
          </p>
        </Link>
        <Link
          href="/admin/pets"
          className="rounded-2xl border border-lavender/30 bg-cream p-6 transition hover:border-gold/40"
        >
          <h3 className="font-medium text-gold-dark">Customers & Pets</h3>
          <p className="mt-2 text-sm text-text-muted">
            Owner profiles, pets, past appointment dates, and paid orders.
          </p>
        </Link>
        <Link
          href="/admin/profile"
          className="rounded-2xl border border-lavender/30 bg-cream p-6 transition hover:border-gold/40"
        >
          <h3 className="font-medium text-gold-dark">My Admin Profile</h3>
          <p className="mt-2 text-sm text-text-muted">
            Your name, role, and work contact details.
          </p>
        </Link>
        {showTeam ? (
          <Link
            href="/admin/team"
            className="rounded-2xl border border-lavender/30 bg-cream p-6 transition hover:border-gold/40"
          >
            <h3 className="font-medium text-gold-dark">Admin Team</h3>
            <p className="mt-2 text-sm text-text-muted">
              Add admins, confirm access, and remove accounts. Only the owner
              can do this.
            </p>
          </Link>
        ) : null}
        <Link
          href="/account"
          className="rounded-2xl border border-lavender/30 bg-cream p-6 transition hover:border-gold/40"
        >
          <h3 className="font-medium text-gold-dark">Preview Customer Account</h3>
          <p className="mt-2 text-sm text-text-muted">
            See what customers see in their profile and inbox.
          </p>
        </Link>
      </div>
    </div>
  );
}
