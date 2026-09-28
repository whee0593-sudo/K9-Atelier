import { AddCommunicationCustomer } from "@/components/admin/AddCommunicationCustomer";

export const dynamic = "force-dynamic";

export default function CommunicationPreviewAddPage() {
  return <AddCommunicationCustomer preview previewPhone="(561) 555-0199" />;
}