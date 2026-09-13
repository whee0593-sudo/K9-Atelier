import { BookForCustomerForm } from "@/components/admin/BookForCustomerForm";

export default function BookForCustomerPreviewPage() {
  return (
    <div>
      <p className="mb-4 rounded-xl border border-gold/40 bg-lavender-light/50 px-4 py-2 text-center text-xs uppercase tracking-[0.16em] text-gold-dark">
        Preview only · Submit does not create a live account
      </p>
      <h2 className="text-2xl font-semibold text-gold-dark">
        Book for a customer
      </h2>
      <p className="mt-2 text-sm text-text-muted">
        Staff form for creating a customer account, reserving a visit, and
        sending a confirmation link.
      </p>
      <div className="mt-8">
        <BookForCustomerForm
          preview
          prefill={{
            firstName: "Ada",
            lastName: "Lovelace",
            email: "ada@example.com",
            phone: "+15615550123",
          }}
        />
      </div>
    </div>
  );
}
