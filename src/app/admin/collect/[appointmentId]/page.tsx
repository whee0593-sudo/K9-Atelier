import { CollectCheckout } from "@/components/admin/CollectCheckout";
import { getBrandPublicLinks } from "@/lib/business";
import type { ChargeKind } from "@/lib/charges/types";

export default async function CollectPage({
  params,
  searchParams,
}: {
  params: Promise<{ appointmentId: string }>;
  searchParams: Promise<{ kind?: string; view?: string }>;
}) {
  const { appointmentId } = await params;
  const query = await searchParams;
  const kind: ChargeKind = query.kind === "no_show" ? "no_show" : "service";
  const initialStep =
    query.view === "refund"
      ? "refund"
      : query.view === "receipt"
        ? "receipt"
        : "review";

  return (
    <CollectCheckout
      appointmentId={appointmentId}
      kind={kind}
      initialStep={initialStep}
      brandLinks={getBrandPublicLinks()}
    />
  );
}
