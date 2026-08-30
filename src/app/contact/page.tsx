import { PageShell } from "@/components/luxury/PageShell";
import { ContactBoardForm } from "@/components/support/ContactBoardForm";
import { SupportContactForm } from "@/components/support/SupportContactForm";

export const metadata = {
  title: "Contact · K9 Atelier",
  description:
    "Leave a message for K9 Atelier, a Private Mobile Pet Spa in Palm Beach.",
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; inquiry?: string }>;
}) {
  const { topic, inquiry } = await searchParams;
  if (topic === "concern") {
    return (
      <PageShell
        eyebrow="Private Message"
        title="Report a Concern"
        intro="Share what happened and we will follow up with you privately."
      >
        <div className="mx-auto max-w-xl">
          <SupportContactForm variant="concern" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="Get in Touch"
      title={
        <>
          A Private Appointment
          <br />
          Starts With a Conversation.
        </>
      }
      intro="Questions about your dog's grooming needs or the K9 Atelier experience? Leave a message and we will get back to you."
    >
      <div className="mx-auto max-w-xl">
        <ContactBoardForm initialInquiry={inquiry} />
      </div>
    </PageShell>
  );
}
