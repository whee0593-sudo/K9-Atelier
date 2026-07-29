import type { AccountField } from "@/lib/account-fields";

function inputClassName() {
  return "mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm text-text placeholder:text-text-muted/50";
}

export function AccountFieldPreview({ field }: { field: AccountField }) {
  if (field.type === "section-heading") {
    return (
      <div className="border-t border-lavender/30 pt-6">
        <h3 className="text-base font-medium text-gold-dark">{field.label}</h3>
        {field.note && (
          <p className="mt-1 text-xs text-text-muted">{field.note}</p>
        )}
      </div>
    );
  }

  if (field.type === "file") {
    return (
      <div>
        <label className="block text-sm font-medium text-text">
          {field.label}
          {field.required && <span className="text-gold"> *</span>}
        </label>
        <div className="mt-1.5 rounded-xl border border-dashed border-lavender/60 bg-lavender-light/20 px-4 py-6 text-center">
          <p className="text-sm text-text-muted">
            Choose file or drag and drop
          </p>
          <p className="mt-1 text-xs text-text-muted">
            PDF, JPG, PNG, WEBP, or HEIC · Max 10 MB
          </p>
          <input
            type="file"
            disabled
            accept={field.accept}
            className="mt-3 text-xs text-text-muted"
          />
        </div>
        {field.note && (
          <p className="mt-1.5 text-xs text-text-muted">{field.note}</p>
        )}
      </div>
    );
  }

  if (field.type === "message-inbox") {
    return null;
  }

  if (field.type === "payment-list") {
    return (
      <div className="rounded-xl border border-dashed border-lavender/50 bg-lavender-light/30 px-4 py-8 text-center text-sm text-text-muted">
        No saved cards yet. Add a payment method when booking opens.
      </div>
    );
  }

  if (field.type === "booking-list") {
    return (
      <div className="rounded-xl border border-dashed border-lavender/50 bg-lavender-light/30 px-4 py-8 text-center text-sm text-text-muted">
        No appointments yet.
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div>
        <label className="block text-sm font-medium text-text">
          {field.label}
          {field.required && <span className="text-gold"> *</span>}
        </label>
        <textarea
          readOnly
          rows={3}
          placeholder={field.placeholder}
          className={`${inputClassName()} resize-none`}
        />
        {field.note && (
          <p className="mt-1.5 text-xs text-text-muted">{field.note}</p>
        )}
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div>
        <label className="block text-sm font-medium text-text">
          {field.label}
          {field.required && <span className="text-gold"> *</span>}
        </label>
        <select disabled className={inputClassName()}>
          <option>Select…</option>
          {field.options?.map((opt) => (
            <option key={opt}>{opt}</option>
          ))}
        </select>
        {field.note && (
          <p className="mt-1.5 text-xs text-text-muted">{field.note}</p>
        )}
      </div>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm text-text">
        <input type="checkbox" disabled className="rounded border-lavender" />
        {field.label}
      </label>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-text">
        {field.label}
        {field.required && <span className="text-gold"> *</span>}
      </label>
      <input
        readOnly
        type={
          field.type === "number"
            ? "text"
            : field.type === "date"
              ? "date"
              : field.type
        }
        placeholder={field.placeholder}
        className={inputClassName()}
      />
      {field.note && (
        <p className="mt-1.5 text-xs text-text-muted">{field.note}</p>
      )}
    </div>
  );
}

export function AccountFieldsForm({
  fields,
  audience = "customer",
}: {
  fields: AccountField[];
  audience?: "customer" | "admin";
}) {
  const visibleFields = fields.filter(
    (f) => audience === "admin" || !f.adminOnly,
  );
  const listFields = visibleFields.filter(
    (f) => f.type === "payment-list" || f.type === "booking-list",
  );

  const orderedItems = visibleFields.filter(
    (f) =>
      f.type !== "payment-list" &&
      f.type !== "booking-list" &&
      f.type !== "message-inbox",
  );

  return (
    <div className="space-y-5">
      {orderedItems.map((field) => (
        <AccountFieldPreview key={field.id} field={field} />
      ))}
      {listFields.map((field) => (
        <div key={field.id}>
          <p className="mb-2 text-sm font-medium text-text">{field.label}</p>
          <AccountFieldPreview field={field} />
          {field.note && (
            <p className="mt-1.5 text-xs text-text-muted">{field.note}</p>
          )}
        </div>
      ))}
    </div>
  );
}
