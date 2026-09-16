import { notFound } from "next/navigation";
import { CustomerBookingsList } from "@/components/account/CustomerBookingsList";
import { AccountFieldsForm } from "@/components/account/AccountFieldsForm";
import { CustomerProfileSection } from "@/components/account/CustomerProfileForm";
import { PaymentMethodsManager } from "@/components/account/PaymentMethodsManager";
import { PetProfilesManager } from "@/components/account/PetProfilesManager";
import { ReferralRewardsPanel } from "@/components/account/ReferralRewardsPanel";
import { getAccountSection } from "@/lib/account-fields";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ setup?: string; pet?: string }>;
};

const SECTION_IDS = [
  "profile",
  "addresses",
  "pets",
  "payment",
  "bookings",
  "appointments",
  "referrals",
] as const;

export function generateStaticParams() {
  return SECTION_IDS.map((slug) => ({ slug }));
}

export default async function AccountSectionPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const section = getAccountSection(slug);
  if (!section) notFound();
  const fromAccountSetup = query.setup === "1";
  const setupPetId = query.pet?.trim() || null;

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gold-dark">{section.title}</h2>
      <p className="mt-2 text-sm text-text-muted">{section.description}</p>

      <div className="mt-8 rounded-2xl border border-lavender/30 bg-cream p-6 md:p-8">
        {slug === "pets" ? (
          <PetProfilesManager setup={fromAccountSetup} setupPetId={setupPetId} />
        ) : slug === "bookings" || slug === "appointments" ? (
          <CustomerBookingsList />
        ) : slug === "payment" ? (
          <PaymentMethodsManager fromAccountSetup={fromAccountSetup} />
        ) : slug === "referrals" ? (
          <ReferralRewardsPanel />
        ) : slug === "profile" ? (
          <CustomerProfileSection />
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
