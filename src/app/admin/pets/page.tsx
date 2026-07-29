import { AccountFieldsForm } from "@/components/account/AccountFieldsForm";
import { getAccountSection } from "@/lib/account-fields";
import { demoPetProfiles, formatPetSummary } from "@/lib/pets";

const adminOnlyFields = (getAccountSection("pets")?.fields ?? []).filter(
  (f) => f.adminOnly,
);

export default function AdminPetsPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-gold-dark">Pet Service Notes</h2>
      <p className="mt-2 text-sm text-text-muted">
        Record products and services used on each visit. Only admins can see
        this — not visible on customer pet profiles.
      </p>

      <div className="mt-8 space-y-6">
        {demoPetProfiles.map((pet) => (
          <article
            key={pet.id}
            className="rounded-2xl border border-lavender/30 bg-cream p-6"
          >
            <h3 className="font-medium text-text">{formatPetSummary(pet)}</h3>
            <div className="mt-4">
              <AccountFieldsForm fields={adminOnlyFields} audience="admin" />
              {pet.adminServiceNotes && (
                <p className="mt-3 rounded-lg bg-lavender-light/40 px-3 py-2 text-sm text-text-muted">
                  Example: {pet.adminServiceNotes}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
