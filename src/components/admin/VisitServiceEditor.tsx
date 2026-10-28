"use client";

import { catalogLinePatch } from "@/lib/charges/list-amount";
import { formatChargeMoney, sumLineItems } from "@/lib/charges/money";
import type {
  CatalogChargeGroup,
  CatalogChargeItem,
  ChargeLineItem,
} from "@/lib/charges/types";
import { ServiceCategoryPicker } from "@/components/admin/ServiceCategoryPicker";

function newLineId() {
  return crypto.randomUUID();
}

export function VisitServiceEditor({
  lineItems,
  catalogGroups,
  disabled = false,
  saving = false,
  dirty = false,
  notice = null,
  onChange,
  onSave,
}: {
  lineItems: ChargeLineItem[];
  catalogGroups: CatalogChargeGroup[];
  disabled?: boolean;
  saving?: boolean;
  dirty?: boolean;
  notice?: string | null;
  onChange: (items: ChargeLineItem[]) => void;
  onSave: () => void;
}) {
  const catalog = catalogGroups.flatMap((group) => group.items);
  const estimatedTotal = Math.round(sumLineItems(lineItems) * 100) / 100;

  function updateItem(id: string, patch: Partial<ChargeLineItem>) {
    onChange(lineItems.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addCatalogItem(item: CatalogChargeItem) {
    const patch = catalogLinePatch(item);
    if (patch.amount == null) return;
    onChange([
      ...lineItems,
      {
        id: newLineId(),
        ...patch,
        amount: patch.amount,
      },
    ]);
  }

  return (
    <section className="mt-8 text-left">
      <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
        Today’s services
      </p>
      <ul className="mt-4 space-y-3">
        {lineItems.map((item, index) => (
          <li
            key={item.id}
            className="rounded-2xl border border-lavender/40 bg-cream p-4"
          >
            {index === 0 && catalogGroups.length > 0 ? (
              <fieldset disabled={disabled || saving}>
              <ServiceCategoryPicker
                groups={catalogGroups}
                selectedId={item.catalogId}
                selectedLabel={item.label}
                onSelect={(catalogItem) => {
                  if (catalogItem.suggestedAmount == null) return;
                  const patch = catalogLinePatch(catalogItem);
                  if (patch.amount == null) return;
                  updateItem(item.id, { ...patch, amount: patch.amount });
                }}
              />
              </fieldset>
            ) : (
              <input
                value={item.label}
                disabled={disabled || saving || item.catalogId === "travel-fee"}
                onChange={(event) =>
                  updateItem(item.id, { label: event.target.value })
                }
                className="w-full rounded-xl border border-lavender/40 bg-white px-3 py-2 text-sm text-ink"
              />
            )}
            <div className="mt-3 flex items-center gap-3">
              <label className="font-body flex-1 text-xs text-taupe">
                Amount
                <input
                  type="number"
                  min="0"
                  max="5000"
                  step="0.01"
                  disabled={disabled || saving || item.catalogId === "travel-fee"}
                  value={item.amount}
                  onChange={(event) =>
                    updateItem(item.id, {
                      amount: Math.max(0, Number(event.target.value) || 0),
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-lavender/40 bg-white px-3 py-2 text-sm text-ink"
                />
              </label>
              <button
                type="button"
                disabled={disabled || saving || lineItems.length <= 1 || item.catalogId === "travel-fee"}
                onClick={() =>
                  onChange(lineItems.filter((entry) => entry.id !== item.id))
                }
                className="mt-5 text-sm text-red-800 underline disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-taupe">Change the visit travel fee in Appointment details. It is charged once per visit.</p>

      <button
        type="button"
        disabled={disabled || saving}
        onClick={() =>
          onChange([
            ...lineItems,
            {
              id: newLineId(),
              label: "Additional care",
              amount: 0,
            },
          ])
        }
        className="mt-4 text-sm text-ink underline disabled:opacity-40"
      >
        Add a custom charge
      </button>

      <label className="font-body mt-4 block text-sm text-taupe">
        Add a service
        <select
          defaultValue=""
          disabled={disabled || saving}
          onChange={(event) => {
            const next = catalog.find((item) => item.id === event.target.value);
            if (next) addCatalogItem(next);
            event.target.value = "";
          }}
          className="mt-1 w-full rounded-xl border border-lavender/40 bg-white px-3 py-2 text-sm text-ink"
        >
          <option value="">Choose a service to add</option>
          {catalogGroups.map((group) => (
            <optgroup key={group.id} label={group.name}>
              {group.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.suggestedAmount != null
                    ? ` · ${formatChargeMoney(item.suggestedAmount)}`
                    : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <p className="font-display mt-6 text-center text-3xl text-ink">
        {formatChargeMoney(estimatedTotal)}
      </p>
      <p className="mt-1 text-center text-xs text-taupe">Estimated total</p>

      {dirty ? <button
        type="button"
        disabled={disabled || saving || lineItems.length === 0}
        onClick={onSave}
        className="mt-5 w-full rounded-sm border border-lavender/50 bg-white px-6 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-ink disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button> : null}
      {notice ? (
        <p className="mt-3 text-center text-sm text-taupe" role="status">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
