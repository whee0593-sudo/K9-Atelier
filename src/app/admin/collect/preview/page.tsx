import { CollectCheckout } from "@/components/admin/CollectCheckout";
import type { ChargeKind } from "@/lib/charges/types";

export default async function CollectPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; step?: string; view?: string }>;
}) {
  const query = await searchParams;
  const kind: ChargeKind = query.kind === "no_show" ? "no_show" : "service";
  const requested = query.view ?? query.step;
  const step =
    requested === "pay" || requested === "receipt" || requested === "refund"
      ? requested
      : "review";

  return (
    <CollectCheckout
      appointmentId="preview"
      kind={kind}
      preview
      initialStep={step}
    />
  );
}
