import adminFields from "../../content/admin-fields.json";

export type AdminField = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

export const adminConfig = adminFields as {
  overview: { title: string; description: string };
  roles: string[];
  fields: AdminField[];
};
