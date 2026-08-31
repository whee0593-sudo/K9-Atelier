import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/pets/auth";
import { getAccountReferralView } from "@/lib/referrals/service";

export async function GET() {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const view = await getAccountReferralView(user.id);
  return NextResponse.json(view);
}
