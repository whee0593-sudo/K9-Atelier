import { EmailAppointmentConfirmation } from "@/components/account/EmailAppointmentConfirmation";
import { Container } from "@/components/luxury/Container";

export const metadata = { title: "Confirm your appointment | K9 Atelier", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function EmailConfirmationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <Container className="py-20 md:py-32"><div className="mx-auto max-w-xl text-center">
    <EmailAppointmentConfirmation token={token?.trim() ?? ""} />
  </div></Container>;
}
