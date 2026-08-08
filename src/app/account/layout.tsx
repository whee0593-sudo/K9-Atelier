import { AccountNav } from "@/components/account/AccountNav";
import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { accountConfig } from "@/lib/account-fields";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <BookServiceLink className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-gold px-6 py-3 text-sm font-medium text-white transition hover:bg-gold-dark sm:ml-auto">
          Book Service
        </BookServiceLink>
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
