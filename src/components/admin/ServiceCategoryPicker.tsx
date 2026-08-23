"use client";

import { useEffect, useRef, useState } from "react";
import { formatChargeMoney } from "@/lib/charges/money";
import type { CatalogChargeGroup, CatalogChargeItem } from "@/lib/charges/types";

export function ServiceCategoryPicker({
  groups,
  selectedId,
  selectedLabel,
  onSelect,
}: {
  groups: CatalogChargeGroup[];
  selectedId?: string;
  selectedLabel: string;
  onSelect: (item: CatalogChargeItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, [open]);

  useEffect(() => {
    const match = groups.find((group) =>
      group.items.some((item) => item.id === selectedId || item.name === selectedLabel),
    );
    if (match) setExpandedId(match.id);
  }, [groups, selectedId, selectedLabel]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between rounded-xl border border-lavender/40 bg-white px-3 py-2 text-left text-sm text-ink"
        aria-expanded={open}
      >
        <span>{selectedLabel}</span>
        <span className="text-taupe">{open ? "▴" : "▾"}</span>
      </button>
      {open ? (
        <div className="absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-lavender/40 bg-white p-2 shadow-lg">
          {groups.map((group) => {
            const expanded = expandedId === group.id;
            return (
              <div key={group.id} className="mb-1">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId((current) =>
                      current === group.id ? null : group.id,
                    )
                  }
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-ink hover:bg-cream"
                >
                  <span>{group.name}</span>
                  <span className="text-xs text-taupe">{expanded ? "−" : "+"}</span>
                </button>
                {expanded ? (
                  <ul className="mb-1 ml-2 border-l border-lavender/30 pl-2">
                    {group.items.map((item) => {
                      const selected =
                        item.id === selectedId || item.name === selectedLabel;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => {
                              onSelect(item);
                              setOpen(false);
                            }}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm ${
                              selected
                                ? "bg-lavender-light text-gold-dark"
                                : "text-ink hover:bg-cream"
                            }`}
                          >
                            <span>{item.name}</span>
                            {item.suggestedAmount != null ? (
                              <span className="shrink-0 text-xs text-taupe">
                                {formatChargeMoney(item.suggestedAmount)}
                              </span>
                            ) : (
                              <span className="shrink-0 text-xs text-taupe">
                                Consult
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
