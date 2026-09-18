import { FinanceReport } from "@/components/admin/FinanceReport";

export default function FinancePreviewPage() {
  return (
    <div>
      <p className="mb-4 rounded-xl border border-gold/40 bg-lavender-light/50 px-4 py-2 text-center text-xs uppercase tracking-[0.16em] text-gold-dark">
        Preview only · July sample revenue
      </p>
      <h2 className="text-2xl font-semibold text-gold-dark">Finance</h2>
      <div className="mt-8">
        <FinanceReport preview />
      </div>
    </div>
  );
}
