import accountFields from "../../content/account-fields.json";

export type AccountField = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  adminOnly?: boolean;
  placeholder?: string;
  note?: string;
  options?: string[];
  accept?: string;
};

export type AccountSection = {
  id: string;
  path: string;
  title: string;
  description: string;
  fields: AccountField[];
};

export const accountConfig = accountFields as {
  overview: { title: string; description: string };
  sections: AccountSection[];
};

export function getAccountSection(id: string) {
  const slug = id === "appointments" ? "bookings" : id;
  return accountConfig.sections.find((s) => s.id === slug);
}

/** First-screen shortcuts after login on a phone. */
export const ACCOUNT_HUB_PRIMARY_IDS = [
  "bookings",
  "pets",
  "payment",
  "profile",
] as const;

/** Secondary account pages, listed under More. */
export const ACCOUNT_HUB_MORE_IDS = [
  "addresses",
  "referrals",
  "messages",
  "password",
] as const;

const HUB_HINTS: Record<string, string> = {
  bookings: "Upcoming and past visits",
  pets: "Profiles and vaccine records",
  payment: "Cards on file",
  profile: "Name and contact details",
};

export function accountHubHint(sectionId: string) {
  return HUB_HINTS[sectionId] ?? "";
}

export function accountHubSections(group: "primary" | "more"): AccountSection[] {
  const ids = group === "primary" ? ACCOUNT_HUB_PRIMARY_IDS : ACCOUNT_HUB_MORE_IDS;
  return ids.flatMap((id) => {
    const section = getAccountSection(id);
    return section ? [section] : [];
  });
}

export function accountHubListsEverySection() {
  const listed = new Set<string>([
    ...ACCOUNT_HUB_PRIMARY_IDS,
    ...ACCOUNT_HUB_MORE_IDS,
  ]);
  return (
    listed.size === accountConfig.sections.length &&
    accountConfig.sections.every((section) => listed.has(section.id))
  );
}

export function filterFieldsByAudience(
  fields: AccountField[],
  audience: "customer" | "admin",
) {
  if (audience === "admin") return fields;
  return fields.filter((f) => !f.adminOnly);
}
