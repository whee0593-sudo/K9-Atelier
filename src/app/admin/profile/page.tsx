import Link from "next/link";
import { adminConfig } from "@/lib/admin-fields";

const previewValues: Record<string, string> = {
  displayName: "Penny",
  email: "penny@k9atelier.com",
  role: "Owner",
};

export default function AdminProfilePage() {
  const { fields } = adminConfig;

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gold-dark">My Admin Profile</h2>
      <p className="mt-2 text-sm text-text-muted">
        {adminConfig.overview.description}
      </p>

      <div className="mt-8 space-y-5 rounded-2xl border border-lavender/30 bg-cream p-6 md:p-8">
        {fields.map((field) => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-text">
              {field.label}
              {field.required && <span className="text-gold"> *</span>}
            </label>
            {field.type === "select" ? (
              <select
                disabled
                defaultValue={previewValues[field.id] ?? field.options?.[0]}
                className="mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm"
              >
                {field.options?.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                readOnly
                type={field.type}
                placeholder={field.placeholder}
                defaultValue={previewValues[field.id]}
                className="mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm"
              />
            )}
          </div>
        ))}
        <p className="text-xs text-text-muted">
          Preview mode — admin profiles will require secure login when live.
        </p>
        <Link
          href="/admin/messages"
          className="inline-block rounded-xl bg-gold px-6 py-2.5 text-sm font-medium text-white hover:bg-gold-dark"
        >
          Send message to a customer
        </Link>
      </div>
    </div>
  );
}
