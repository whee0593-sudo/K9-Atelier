import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  buildPreviewSharePath,
  getPreviewShareToken,
  isValidSiteAccessCookie,
} from "@/lib/site-access";

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get("k9-site-access")?.value;
  const authenticated = await isValidSiteAccessCookie(cookie);

  if (!authenticated) {
    return NextResponse.json({ error: "Preview access required." }, { status: 401 });
  }

  const token = getPreviewShareToken();
  const path = buildPreviewSharePath(token);

  if (!path) {
    return NextResponse.json(
      {
        error:
          "Preview share link is not configured. Add SITE_PREVIEW_SHARE_TOKEN in Vercel.",
      },
      { status: 503 },
    );
  }

  const url = new URL(path, request.nextUrl.origin).toString();

  return NextResponse.json({ url });
}
