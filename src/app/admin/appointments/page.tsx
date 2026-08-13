import { redirect } from "next/navigation";
import { AppointmentReviewPanel } from "@/components/admin/AppointmentReviewPanel";
import { getStaffSession } from "@/lib/staff/auth";
import Link from "next/link";

export default async function AdminAppointmentsPage() {
  const session = await getStaffSession();

  if ("error" in session) {
    if (session.error === "unauthenticated") {
      redirect("/login?next=/admin/appointments");
    }

    return (
      <div>
        <h2 className="text-2xl font-semibold text-gold-dark">Appointments</h2>
        <div className="mt-8 rounded-2xl border border-lavender/30 bg-cream p-6">
          <p className="text-sm text-text">
            Staff access is required to review appointment requests.
          </p>
          <Link
            href="/login?next=/admin/appointments"
            className="mt-4 inline-block text-sm font-medium text-gold-dark underline"
          >
            Staff sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gold-dark">Appointments</h2>
      <p className="mt-2 text-sm text-text-muted">
        Confirm or decline appointment requests that are waiting on staff
        approval.
      </p>
      <AppointmentReviewPanel />
    </div>
  );
}
