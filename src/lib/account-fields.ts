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

export function filterFieldsByAudience(
  fields: AccountField[],
  audience: "customer" | "admin",
) {
  if (audience === "admin") return fields;
  return fields.filter((f) => !f.adminOnly);
}
