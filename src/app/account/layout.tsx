import { redirect } from "next/navigation";
import { AccountBackLink } from "@/components/account/AccountBackLink";
import { AccountNav } from "@/components/account/AccountNav";
import { CustomerSignOutButton } from "@/components/auth/CustomerSignOutButton";
import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { accountConfig } from "@/lib/account-fields";
import { readRequestPathname } from "@/lib/request-path";
import { createClient } from "@/lib/supabase/server";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const pathname = await readRequestPathname("/account");
    redirect(`/login?next=${pathname}`);
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-6 md:py-12">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="min-w-0 flex-1 pr-2 text-xl font-semibold text-gold-dark">
          {accountConfig.overview.title}
        </h1>
        <div className="flex shrink-0 items-center gap-3">
          <BookServiceLink className="hidden min-h-[44px] items-center justify-center rounded-2xl bg-gold px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gold-dark md:inline-flex">
            Book an Appointment
          </BookServiceLink>
          <CustomerSignOutButton />
        </div>
      </header>

      <div className="grid gap-8 md:grid-cols-[220px_1fr] md:gap-10">
        <aside className="hidden md:block">
          <AccountNav />
        </aside>
        <div>
          <AccountBackLink />
          {children}
        </div>
      </div>
    </div>
  );
}
