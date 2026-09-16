import { redirect } from "next/navigation";
import { AccountNav } from "@/components/account/AccountNav";
import { CustomerSignOutButton } from "@/components/auth/CustomerSignOutButton";
import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { accountConfig } from "@/lib/account-fields";
import { getAccountNavSummaries } from "@/lib/account-nav-summaries-load";
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
  const pathname = await readRequestPathname("/account");

  if (!user) {
    redirect(`/login?next=${pathname}`);
  }

  const summaries = await getAccountNavSummaries(user.id);
  const isOverview = pathname === "/account";

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="min-w-0 flex-1 pr-2 text-xl font-semibold text-gold-dark">
          {accountConfig.overview.title}
        </h1>
        <CustomerSignOutButton />
      </header>

      <div className="mb-6 flex justify-end">
        <BookServiceLink className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-gold px-6 py-3 text-sm font-medium text-white transition hover:bg-gold-dark">
          Book an Appointment
        </BookServiceLink>
      </div>

      {isOverview ? (
        <aside className="max-w-xl">
          <AccountNav summaries={summaries} />
        </aside>
      ) : (
        <div className="grid gap-10 md:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]">
          <aside>
            <AccountNav summaries={summaries} />
          </aside>
          <div>{children}</div>
        </div>
      )}
    </div>
  );
}
