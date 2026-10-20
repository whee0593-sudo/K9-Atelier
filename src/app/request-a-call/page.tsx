import { PageShell } from "@/components/luxury/PageShell";
import { CallRequestForm } from "@/components/booking/CallRequestForm";
import { callRequestsConfigured } from "@/lib/call-requests/server";
import { business } from "@/lib/business";
export const dynamic = "force-dynamic";
export const metadata = { title: "Request a Call · K9 Atelier", referrer: "no-referrer" as const, robots: { index: false, follow: true } };
export default function RequestCallPage() {
  return <PageShell eyebrow="Request a Call" title="Let’s plan your dog’s visit." intro="Leave your name and phone number. Penny will call to discuss your dog’s care.">
    <div className="mx-auto max-w-xl space-y-8">
      <p className="font-body text-center text-base text-ink">Save your card securely with Stripe. No charge today.</p>
      <CallRequestForm configured={callRequestsConfigured()} phoneLabel={business.brand.phone} phoneHref={`tel:${business.brand.phone.replace(/[^+\d]/g, "")}`} />
    </div>
  </PageShell>;
}
