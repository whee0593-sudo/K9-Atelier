import Link from "next/link";
import { redirect } from "next/navigation";
import { VaccinationReviewPanel } from "@/components/admin/VaccinationReviewPanel";
import { getStaffSession } from "@/lib/staff/auth";

export default async function AdminVaccinationsPage() {
  const session = await getStaffSession();

  if ("error" in session) {
    if (session.error === "unauthenticated") {
      redirect("/login?next=/admin/vaccinations");
    }

    return (
      <div>
        <h2 className="text-2xl font-semibold text-gold-dark">
          Vaccination Review
        </h2>
        <div className="mt-8 rounded-2xl border border-lavender/30 bg-cream p-6">
          <p className="text-sm text-text">
            Staff access is required to review customer vaccination uploads.
          </p>
          <Link
            href="/login?next=/admin/vaccinations"
            className="mt-4 inline-block text-sm font-medium text-gold-dark underline"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gold-dark">
        Vaccination Review
      </h2>
      <VaccinationReviewPanel />
    </div>
  );
}
