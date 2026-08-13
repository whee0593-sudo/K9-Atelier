import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-gold-dark">Dashboard</h2>
      <p className="mt-2 text-sm text-text-muted">
        Manage customer profiles, send messages and files, and record service
        notes.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/appointments"
          className="rounded-2xl border border-lavender/30 bg-cream p-6 transition hover:border-gold/40"
        >
          <h3 className="font-medium text-gold-dark">Appointments</h3>
          <p className="mt-2 text-sm text-text-muted">
            Confirm or decline appointment requests waiting on staff approval.
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
          <h3 className="font-medium text-gold-dark">Pet Service Notes</h3>
          <p className="mt-2 text-sm text-text-muted">
            Internal notes on products and services used per pet.
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
