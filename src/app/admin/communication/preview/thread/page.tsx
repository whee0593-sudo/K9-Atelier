import { CommunicationThread } from "@/components/admin/CommunicationThread";

export const dynamic = "force-dynamic";

export default async function CommunicationPreviewThreadPage({
  searchParams,
}: {
  searchParams: Promise<{ who?: string; compose?: string }>;
}) {
  const query = await searchParams;
  const who = query.who || "tia";
  return <CommunicationThread previewWho={who} compose={query.compose === "1"} />;
}
