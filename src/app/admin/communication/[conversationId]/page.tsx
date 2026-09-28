import { CommunicationThread } from "@/components/admin/CommunicationThread";

export const dynamic = "force-dynamic";

export default async function AdminCommunicationThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ compose?: string }>;
}) {
  const [{ conversationId }, query] = await Promise.all([params, searchParams]);
  return (
    <CommunicationThread
      conversationId={conversationId}
      compose={query.compose === "1"}
    />
  );
}
