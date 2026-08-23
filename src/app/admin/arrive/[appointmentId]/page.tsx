import { VisitCheckIn } from "@/components/admin/VisitCheckIn";

export default async function ArrivePage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;
  return <VisitCheckIn appointmentId={appointmentId} />;
}
