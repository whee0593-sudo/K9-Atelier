import Link from "next/link";
import { ConfirmAccountForm } from "@/components/account/ConfirmAccountForm";
import { bookingSecondaryBtnClass } from "@/components/booking/booking-ui";
import { ACCOUNT_SETUP_PATH } from "@/lib/account-setup";
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
        <h1 className="sr-only">Confirm your appointment</h1>
        {trimmed ? (
          <ConfirmAccountForm token={trimmed} />
        ) : (
          <p className="font-body mt-6 text-sm text-red-700" role="alert">
            This confirmation link is missing. Please use the link from your
            email or text, or contact penny@k9atelier.com
          </p>
        )}
        <p className="font-body mt-8 text-center text-sm text-taupe">Need to change something?</p>
        <Link
          href={ACCOUNT_SETUP_PATH}
          className={`${bookingSecondaryBtnClass} mt-3 w-full`}
        >
          Go to my profile
        </Link>
      </div>
    </Container>
  );
}
