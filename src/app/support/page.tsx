import { SupportContactForm } from "@/components/support/SupportContactForm";

export const metadata = {
  title: "Support · K9 Atelier",
  description:
    "Contact K9 Atelier with questions about booking, services, or your appointment.",
};

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-gold-dark">Support</h1>
        <p className="mt-6 text-text-muted">
          Questions about booking, services, or your appointment? Send us a
          message and we&apos;ll reply as soon as we can.
        </p>
      </div>

      <SupportContactForm />
    </div>
  );
}
