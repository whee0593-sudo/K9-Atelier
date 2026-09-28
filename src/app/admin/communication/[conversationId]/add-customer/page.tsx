import { AddCommunicationCustomer } from "@/components/admin/AddCommunicationCustomer";

export const dynamic = "force-dynamic";

export default async function AddCommunicationCustomerPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  return <AddCommunicationCustomer conversationId={conversationId} />;
}
