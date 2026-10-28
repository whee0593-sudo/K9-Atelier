import React from "react";
import { ChargeMoneyWithList } from "./ChargeMoneyWithList";
import { groupChargeItems } from "@/lib/charges/receipt-items";
import type { ChargeLineItem } from "@/lib/charges/types";

export function ChargeServiceRows({ lineItems, pets, fallbackPetName }: {
  lineItems: ChargeLineItem[];
  pets?: Array<{ id: string; petName: string }>;
  fallbackPetName?: string;
}) {
  return <ul className="mt-5 space-y-4" aria-label="Service charges">
    {groupChargeItems(lineItems, pets, fallbackPetName).map((group, i) => <li key={i}>
      <ul className="space-y-2" aria-label={group.petName || "Visit charges"}>
        {group.items.map((item, index) => <li key={item.id} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.8fr)_auto] items-baseline gap-x-3 text-sm sm:text-base">
          {group.petName ? <><span className="break-words font-semibold">{index === 0 ? group.petName : ""}</span><span className="min-w-0 break-words">{item.label}</span></>
            : <span className="col-span-2 min-w-0 break-words">{item.label}</span>}
          <ChargeMoneyWithList item={item} showListAmount={false} />
        </li>)}
      </ul>
    </li>)}
  </ul>;
}
