import Link from "next/link";
import { ConfirmAccountForm } from "@/components/account/ConfirmAccountForm";
import { Container } from "@/components/luxury/Container";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ConfirmAccountPage({ searchParams }: Props) {
  const { token } = await searchParams;
  const trimmed = token?.trim() ?? "";

  return (
    <Container className="py-14 md:py-20">
      <div className="mx-auto max-w-xl">
        <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
          Appointment
        </p>
        <h1 className="font-display mt-4 text-4xl text-ink md:text-5xl">
          Confirm your visit
        </h1>
        <p className="font-body mt-6 text-sm leading-relaxed text-taupe">
          Review the reservation K9 Atelier made for you. Confirming does not
          charge your card.
        </p>
        {trimmed ? (
          <ConfirmAccountForm token={trimmed} />
        ) : (
          <p className="font-body mt-6 text-sm text-red-700" role="alert">
            This confirmation link is missing. Please use the link from your
            email or text, or contact penny@k9atelier.com
          </p>
        )}
        <Link
          href="/"
          className="font-body mt-10 inline-block text-[10px] font-medium uppercase tracking-[0.14em] text-taupe transition hover:text-ink"
        >
          Return Home
        </Link>
      </div>
    </Container>
  );
}
