import Link from "next/link";
import {
  accountConfig,
  accountHubHint,
  accountHubSections,
} from "@/lib/account-fields";

const primaryLinkClass =
  "flex items-center justify-between gap-4 rounded-2xl border border-lavender/30 bg-cream px-5 py-4 transition hover:border-gold/40 hover:bg-lavender-light/30";

const moreLinkClass =
  "flex min-h-[48px] items-center justify-between gap-3 py-3 text-sm text-text transition hover:text-gold-dark";

export function AccountHub() {
  const primary = accountHubSections("primary");
  const more = accountHubSections("more");

  return (
    <div>
      <p className="text-sm leading-relaxed text-text-muted md:text-base">
        {accountConfig.overview.description}
      </p>

      <Link
        href="/book"
        className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-gold px-6 py-3 text-sm font-medium text-white transition hover:bg-gold-dark"
      >
        Book an Appointment
      </Link>

      <ul className="mt-6 space-y-3">
        {primary.map((section) => (
          <li key={section.id}>
            <Link href={section.path} className={primaryLinkClass}>
              <span className="min-w-0">
                <span className="block font-medium text-gold-dark">
                  {section.title}
                </span>
                <span className="mt-1 block text-sm text-text-muted">
                  {accountHubHint(section.id)}
                </span>
              </span>
              <span aria-hidden className="text-taupe">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 border-t border-lavender/30 pt-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-taupe">
          More
        </p>
        <ul className="mt-1 divide-y divide-lavender/20">
          {more.map((section) => (
            <li key={section.id}>
              <Link href={section.path} className={moreLinkClass}>
                <span>{section.title}</span>
                <span aria-hidden className="text-taupe">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
