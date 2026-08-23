import Link from "next/link";
import { redirect } from "next/navigation";
import { FinanceReport } from "@/components/admin/FinanceReport";
import { getStaffSession } from "@/lib/staff/auth";

export default async function AdminFinancePage() {
  const session = await getStaffSession();

  if ("error" in session) {
    if (session.error === "unauthenticated") {
      redirect("/login?next=/admin/finance");
    }

    return (
      <div>
        <h2 className="text-2xl font-semibold text-gold-dark">Finance</h2>
        <div className="mt-8 rounded-2xl border border-lavender/30 bg-cream p-6">
          <p className="text-sm text-text">
            Staff access is required to view revenue.
          </p>
          <Link
            href="/login?next=/admin/finance"
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
      <h2 className="text-2xl font-semibold text-gold-dark">Finance</h2>
      <p className="mt-2 text-sm text-text-muted">
        Paid visits only. Service, tips, and tax are totaled separately. Florida
        grooming service is not taxed, so tax stays at $0 unless you later sell
        retail products.
      </p>
      <div className="mt-8">
        <FinanceReport />
      </div>
    </div>
  );
}
