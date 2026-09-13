import Link from "next/link";
import { AppointmentChangeForm } from "@/components/account/AppointmentChangeForm";

export default async function ManageAppointmentPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;

  return (
    <div>
      <Link
        href="/account/appointments"
        className="text-sm text-text-muted underline hover:text-text"
      >
        Back to appointments
      </Link>
      <h2 className="mt-4 text-2xl font-semibold text-gold-dark">
        Change appointment
      </h2>
      <div className="mt-6 rounded-2xl border border-lavender/30 bg-cream p-6 md:p-8">
        <AppointmentChangeForm appointmentId={appointmentId} />
      </div>
    </div>
  );
}
