import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/pets/auth";
import { validateReferralCodeForCustomer } from "@/lib/referrals/service";

export async function GET(request: Request) {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const code = new URL(request.url).searchParams.get("code") ?? "";
  const result = await validateReferralCodeForCustomer(user.id, code);
  return NextResponse.json(result);
}
