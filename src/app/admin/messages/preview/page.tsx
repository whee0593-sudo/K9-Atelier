import { AdminMessageComposer } from "@/components/admin/AdminMessageComposer";

export default function ContactCustomerPreviewPage() {
  return (
    <div>
      <p className="mb-6 rounded-xl border border-champagne bg-cream px-4 py-2 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-taupe">
        Preview only · sample guests · no texts are sent
      </p>
      <h2 className="text-2xl font-semibold text-gold-dark">
        Contact Customer
      </h2>
      <div className="mt-8">
        <AdminMessageComposer preview />
      </div>
    </div>
  );
}
