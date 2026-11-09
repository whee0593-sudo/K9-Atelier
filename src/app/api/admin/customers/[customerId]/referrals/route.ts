import { NextResponse } from "next/server";
import { jsonError } from "@/lib/pets/errors";
import { isReferralSourceValue, normalizeReferralName } from "@/lib/profiles/referral-source";
import { ProfileValidationError, validateCustomerId } from "@/lib/profiles/validation";
import { releaseExpiredReferralReservations } from "@/lib/referrals/service";
import { getStaffSession } from "@/lib/staff/auth";
import { mapStaffServiceError } from "@/lib/staff/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ customerId: string }>;
};

function routeError(error: unknown) {
  if (error instanceof ProfileValidationError) {
    return jsonError(error.message, 400, error.field);
  }
  console.error("Staff customer referrals failed:", error);
  return jsonError("Could not load or save referral details.", 500);
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getStaffSession();
    if ("error" in session) return mapStaffServiceError(session.error);

    const customerId = validateCustomerId((await context.params).customerId);
    const admin = createAdminClient();
    await releaseExpiredReferralReservations();
    const [profile, balance] = await Promise.all([
      admin.from("profiles").select("referral_source, referral_name").eq("id", customerId).maybeSingle(),
      admin.rpc("referral_available_cents", { p_customer_id: customerId }),
    ]);
    if (profile.error || balance.error) return routeError(profile.error ?? balance.error);
    if (!profile.data) return jsonError("Customer not found.", 404);
    return NextResponse.json({
      source: profile.data.referral_source,
      name: profile.data.referral_name,
      balanceCents: Number(balance.data),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getStaffSession();
    if ("error" in session) return mapStaffServiceError(session.error);

    const customerId = validateCustomerId((await context.params).customerId);
    const body = await request.json().catch(() => null);
    if (!body || typeof body.source !== "string" || (body.source && !isReferralSourceValue(body.source))) {
      return jsonError("Choose a valid referral source.", 400);
    }

    const { expectedBalanceCents, targetBalanceCents } = body;
    if (!Number.isInteger(expectedBalanceCents) || expectedBalanceCents < -2_147_483_648 ||
        expectedBalanceCents > 2_147_483_647 ||
        (targetBalanceCents !== null && (!Number.isInteger(targetBalanceCents) ||
          targetBalanceCents < 0 || targetBalanceCents > 2_147_483_647))) {
      return jsonError("Enter a valid referral balance.", 400);
    }

    const source = isReferralSourceValue(body.source) ? body.source : null;
    const name = source ? normalizeReferralName(source, body.name) : null;
    await releaseExpiredReferralReservations();
    const { data, error } = await createAdminClient().rpc("staff_update_customer_referrals", {
      p_customer_id: customerId,
      p_admin_id: session.user.id,
      p_source: source,
      p_name: name,
      p_expected_balance: expectedBalanceCents,
      p_target_balance: targetBalanceCents,
    });
    if (error?.message === "customer_not_found") return jsonError("Customer not found.", 404);
    if (error?.message === "referral_balance_changed") {
      return jsonError("The balance changed. Reload referral details before editing it.", 409);
    }
    if (error) return routeError(error);

    return NextResponse.json({ source, name, balanceCents: Number(data) });
  } catch (error) {
    return routeError(error);
  }
}
