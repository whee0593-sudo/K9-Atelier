import Link from "next/link";
import { isOwnerUser } from "@/lib/staff/auth";

export default async function AdminDashboardPage() {
  const showTeam = await isOwnerUser();
  return (
    <div>
      <h2 className="text-2xl font-semibold text-gold-dark">Dashboard</h2>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/appointments"
          className="rounded-2xl border border-lavender/30 bg-cream p-6 transition hover:border-gold/40"
        >
          <h3 className="font-medium text-gold-dark">Calendar</h3>
        </Link>
        <Link
          href="/admin/vaccinations"
          className="rounded-2xl border border-lavender/30 bg-cream p-6 transition hover:border-gold/40"
        >
          <h3 className="font-medium text-gold-dark">Vaccination Review</h3>
        </Link>
        <Link
          href="/admin/finance"
          className="rounded-2xl border border-lavender/30 bg-cream p-6 transition hover:border-gold/40"
        >
          <h3 className="font-medium text-gold-dark">Finance</h3>
        </Link>
        <Link
          href="/admin/referrals"
          className="rounded-2xl border border-lavender/30 bg-cream p-6 transition hover:border-gold/40"
        >
          <h3 className="font-medium text-gold-dark">Referrals</h3>
        </Link>
        <Link
          href="/admin/messages"
          className="rounded-2xl border border-lavender/30 bg-cream p-6 transition hover:border-gold/40"
        >
          <h3 className="font-medium text-gold-dark">Contact Customer</h3>
        </Link>
        <Link
          href="/admin/book-for-customer"
          className="rounded-2xl border border-lavender/30 bg-cream p-6 transition hover:border-gold/40"
        >
          <h3 className="font-medium text-gold-dark">Book for Customer</h3>
        </Link>
        <Link
          href="/admin/pets"
          className="rounded-2xl border border-lavender/30 bg-cream p-6 transition hover:border-gold/40"
        >
          <h3 className="font-medium text-gold-dark">Customers & Pets</h3>
        </Link>
        <Link
          href="/admin/profile"
          className="rounded-2xl border border-lavender/30 bg-cream p-6 transition hover:border-gold/40"
        >
          <h3 className="font-medium text-gold-dark">My Admin Profile</h3>
        </Link>
        {showTeam ? (
          <Link
            href="/admin/team"
            className="rounded-2xl border border-lavender/30 bg-cream p-6 transition hover:border-gold/40"
          >
            <h3 className="font-medium text-gold-dark">Admin Team</h3>
          </Link>
        ) : null}
        <Link
          href="/account"
          className="rounded-2xl border border-lavender/30 bg-cream p-6 transition hover:border-gold/40"
        >
          <h3 className="font-medium text-gold-dark">Preview Customer Account</h3>
        </Link>
      </div>
    </div>
  );
}
