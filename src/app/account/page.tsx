import Link from "next/link";
import { ReferralRewardsPanel } from "@/components/account/ReferralRewardsPanel";
import { accountConfig } from "@/lib/account-fields";

export default function AccountOverviewPage() {
  return (
    <div>
      <p className="text-text-muted">{accountConfig.overview.description}</p>

      <section className="mt-8 rounded-2xl border border-lavender/30 bg-cream p-6 md:p-8">
        <h2 className="font-medium text-gold-dark">Referral Rewards</h2>
        <p className="mt-2 text-sm text-text-muted">
          Share a pet’s referral code. New client households receive 10% off
          eligible services on their first completed visit, and you earn equal
          Referral Credit.
        </p>
        <div className="mt-6">
          <ReferralRewardsPanel />
        </div>
      </section>

      <ul className="mt-8 space-y-4">
        {accountConfig.sections.map((section) => (
          <li key={section.id}>
            <Link
              href={section.path}
              className="block rounded-2xl border border-lavender/30 bg-cream p-5 transition hover:border-gold/40 hover:bg-lavender-light/30"
            >
              <h2 className="font-medium text-gold-dark">{section.title}</h2>
              <p className="mt-2 text-sm text-text-muted">
                {section.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
