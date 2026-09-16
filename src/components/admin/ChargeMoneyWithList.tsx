import { listedAmountIfChanged } from "@/lib/charges/list-amount";
import { formatChargeMoney } from "@/lib/charges/money";
import type { ChargeLineItem } from "@/lib/charges/types";

export function ChargeMoneyWithList({
  item,
  amount,
  listAmount,
  className = "",
}: {
  item?: Pick<ChargeLineItem, "amount" | "listAmount">;
  amount?: number;
  listAmount?: number;
  className?: string;
}) {
  const current = item?.amount ?? amount ?? 0;
  const listed = listedAmountIfChanged({
    amount: current,
    listAmount: item?.listAmount ?? listAmount,
  });

  return (
    <span
      className={`inline-flex items-baseline justify-end gap-2 whitespace-nowrap tabular-nums ${className}`}
    >
      {listed != null ? (
        <span className="text-[#766F75] line-through decoration-[#766F75]">
          {formatChargeMoney(listed)}
        </span>
      ) : null}
      <span>{formatChargeMoney(current)}</span>
    </span>
  );
}
