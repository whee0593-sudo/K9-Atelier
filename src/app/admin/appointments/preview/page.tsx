import { AdminCalendar } from "@/components/admin/AdminCalendar";

export default function CalendarPreviewPage() {
  return (
    <div>
      <p className="mb-4 rounded-xl border border-gold/40 bg-lavender-light/50 px-4 py-2 text-center text-xs uppercase tracking-[0.16em] text-gold-dark">
        Preview only · July completed visits
      </p>
      <h2 className="text-2xl font-semibold text-gold-dark">
        Calendar & Appointments
      </h2>
      <div className="mt-8">
        <AdminCalendar preview />
      </div>
    </div>
  );
}
