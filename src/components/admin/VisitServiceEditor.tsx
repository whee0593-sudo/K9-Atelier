"use client";

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
  notice = null,
  onChange,
  onSave,
}: {
  lineItems: ChargeLineItem[];
  catalogGroups: CatalogChargeGroup[];
  disabled?: boolean;
  saving?: boolean;
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
    onChange([
      ...lineItems,
      {
        id: newLineId(),
        label: item.name,
        amount: item.suggestedAmount ?? 0,
        catalogId: item.id,
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
              <ServiceCategoryPicker
                groups={catalogGroups}
                selectedId={item.catalogId}
                selectedLabel={item.label}
                onSelect={(catalogItem) =>
                  updateItem(item.id, {
                    label: catalogItem.name,
                    amount: catalogItem.suggestedAmount ?? item.amount,
                    catalogId: catalogItem.id,
                  })
                }
              />
            ) : (
              <input
                value={item.label}
                disabled={disabled}
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
                  step="0.01"
                  disabled={disabled}
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
                disabled={disabled || lineItems.length <= 1}
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

      <label className="font-body mt-4 block text-sm text-taupe">
        Add a service
        <select
          defaultValue=""
          disabled={disabled}
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

      <button
        type="button"
        disabled={disabled || saving || lineItems.length === 0}
        onClick={onSave}
        className="mt-5 w-full rounded-sm border border-lavender/50 bg-white px-6 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-ink disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save services"}
      </button>
      {notice ? (
        <p className="mt-3 text-center text-sm text-taupe" role="status">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
