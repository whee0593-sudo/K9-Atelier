import Link from "next/link";
import { CustomerLoginActions } from "@/components/auth/CustomerLoginActions";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const bookingFlow = next === "/book";

  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold text-gold-dark">
        {bookingFlow ? "Sign In to Book" : "Login"}
      </h1>
      <p className="mt-6 text-text-muted">
        {bookingFlow
          ? "Log in to your customer account to schedule grooming for your pet."
          : "Choose how you would like to sign in."}
      </p>

      <CustomerLoginActions next={next} bookingFlow={bookingFlow} />

      <Link href="/" className="mt-8 block text-sm text-text-muted underline">
        Back to Home
      </Link>
    </div>
  );
}
