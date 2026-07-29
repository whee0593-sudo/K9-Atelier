import { AccountFieldsForm } from "@/components/account/AccountFieldsForm";
import { filterFieldsByAudience, getAccountSection } from "@/lib/account-fields";
import { demoPetProfiles, formatPetSummary } from "@/lib/pets";

const allPetFields = getAccountSection("pets")?.fields ?? [];
const adminOnlyFields = allPetFields.filter((f) => f.adminOnly);

export default function AdminPetsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="rounded-xl border border-gold/40 bg-lavender-light/50 px-4 py-3 text-sm text-gold-dark">
        Admin only — this page is not linked on the public site. Customer pet
        profiles do not show the service notes below.
      </p>
      <h1 className="mt-8 text-2xl font-semibold text-gold-dark">
        Pet Service Notes
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        Record products and services used on each visit. Only you can see this.
      </p>

      <div className="mt-8 space-y-6">
        {demoPetProfiles.map((pet) => (
          <article
            key={pet.id}
            className="rounded-2xl border border-lavender/30 bg-cream p-6"
          >
            <h2 className="font-medium text-text">{formatPetSummary(pet)}</h2>
            <div className="mt-4">
              <AccountFieldsForm fields={adminOnlyFields} audience="admin" />
              {pet.adminServiceNotes && (
                <p className="mt-3 rounded-lg bg-lavender-light/40 px-3 py-2 text-sm text-text-muted">
                  Saved example: {pet.adminServiceNotes}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
