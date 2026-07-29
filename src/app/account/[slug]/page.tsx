import { notFound } from "next/navigation";
import { CustomerInbox } from "@/components/account/CustomerInbox";
import { AccountFieldsForm } from "@/components/account/AccountFieldsForm";
import { PetProfilesManager } from "@/components/account/PetProfilesManager";
import { getAccountSection } from "@/lib/account-fields";

type Props = { params: Promise<{ slug: string }> };

const SECTION_IDS = [
  "profile",
  "addresses",
  "pets",
  "payment",
  "messages",
  "bookings",
] as const;

export function generateStaticParams() {
  return SECTION_IDS.map((slug) => ({ slug }));
}

export default async function AccountSectionPage({ params }: Props) {
  const { slug } = await params;
  const section = getAccountSection(slug);
  if (!section) notFound();

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gold-dark">{section.title}</h2>
      <p className="mt-2 text-sm text-text-muted">{section.description}</p>

      <div className="mt-8 rounded-2xl border border-lavender/30 bg-cream p-6 md:p-8">
        {slug === "pets" ? (
          <PetProfilesManager />
        ) : slug === "messages" ? (
          <CustomerInbox />
        ) : slug === "addresses" ? (
          <>
            <p className="mb-6 text-sm text-text-muted">
              You can save multiple addresses. Travel fees are calculated from
              your default service address.
            </p>
            <AccountFieldsForm fields={section.fields} />
            <button
              type="button"
              disabled
              className="mt-6 rounded-xl border border-dashed border-gold/50 px-4 py-2 text-sm text-gold-dark opacity-60"
            >
              + Add another address (coming soon)
            </button>
          </>
        ) : (
          <AccountFieldsForm fields={section.fields} />
        )}
      </div>
    </div>
  );
}
