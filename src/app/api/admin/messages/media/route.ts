import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/staff/auth";
import { mapStaffServiceError } from "@/lib/staff/api-errors";
import { fetchTwilioMedia, isAllowedTwilioMediaUrl } from "@/lib/sms/media-proxy";

export async function GET(request: Request) {
  const session = await getStaffSession();
  if ("error" in session) {
    return mapStaffServiceError(session.error);
  }

  const mediaUrl = new URL(request.url).searchParams.get("url")?.trim() ?? "";
  if (!mediaUrl || !isAllowedTwilioMediaUrl(mediaUrl)) {
    return NextResponse.json({ error: "Invalid media URL." }, { status: 400 });
  }

  const upstream = await fetchTwilioMedia(mediaUrl);
  if (!upstream) {
    return NextResponse.json({ error: "Could not load this photo." }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
}
