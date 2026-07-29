import Link from "next/link";
import { AccountNav } from "@/components/account/AccountNav";
import { accountConfig } from "@/lib/account-fields";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-6 rounded-xl border border-gold/30 bg-lavender-light/40 px-4 py-3 text-sm text-text-muted">
        Preview mode — account sign-in is coming soon. Below is the information
        customers will manage in their profile.{" "}
        <Link href="/login" className="font-medium text-gold-dark underline">
          Login
        </Link>
      </div>

      <div className="grid gap-10 md:grid-cols-[220px_1fr]">
        <aside>
          <h1 className="mb-4 text-xl font-semibold text-gold-dark">
            {accountConfig.overview.title}
          </h1>
          <AccountNav />
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
