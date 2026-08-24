import { AppointmentChangeForm } from "@/components/account/AppointmentChangeForm";

export default function AppointmentChangePreviewPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <p className="rounded-[8px] border border-[#B99A5E] bg-[#FFFDFC] px-4 py-2 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[#766F75]">
        Preview only · sample change-and-confirm
      </p>
      <h2 className="text-2xl font-semibold text-gold-dark">
        Change appointment
      </h2>
      <p className="text-sm text-text-muted">
        Reschedule, cancel, or change the dogs on this visit. Review any fee
        before you confirm.
      </p>
      <AppointmentChangeForm appointmentId="preview-on-the-way-maple" preview />
    </div>
  );
}
