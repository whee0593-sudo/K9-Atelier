import { completeCallRequest, publicCallAction } from "@/lib/call-requests/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return publicCallAction(request, () => completeCallRequest(request));
}
