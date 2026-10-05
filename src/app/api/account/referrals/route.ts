import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/pets/auth";
import { referralClientErrorMessage } from "@/lib/referrals/allocate-code";
import { getAccountReferralView } from "@/lib/referrals/service";

export async function GET() {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    const view = await getAccountReferralView(user.id);
    return NextResponse.json(view);
  } catch (error) {
    return NextResponse.json(
      { error: referralClientErrorMessage(error) },
      { status: 500 },
    );
  }
}
