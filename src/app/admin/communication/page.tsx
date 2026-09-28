import { CommunicationInbox } from "@/components/admin/CommunicationInbox";
import { parseCommunicationFilter } from "@/lib/communication/present";

export const dynamic = "force-dynamic";

export default async function AdminCommunicationPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const query = await searchParams;
  return (
    <CommunicationInbox initialFilter={parseCommunicationFilter(query.filter)} />
  );
}
