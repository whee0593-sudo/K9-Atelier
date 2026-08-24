import { formatChargeMoney } from "@/lib/charges/money";
import type { ChargeLineItem } from "@/lib/charges/types";

export function buildVisitServicesUpdatedSms(input: {
  services: Array<Pick<ChargeLineItem, "label"> | string>;
  estimatedTotal: number;
}) {
  const names = input.services
    .map((item) => (typeof item === "string" ? item : item.label).trim())
    .filter(Boolean);
  const serviceList = names.length > 0 ? names.join(", ") : "updated care";
  return [
    `K9 ATELIER: Today's appointment has been updated. Updated services: ${serviceList}. Estimated total: ${formatChargeMoney(input.estimatedTotal)}.`,
    "",
    "Reply STOP to opt out.",
  ].join("\n");
}
