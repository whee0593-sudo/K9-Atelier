import { NextResponse } from "next/server";
import { previewCustomerPolicyFee } from "@/lib/policy-fees/customer-settle";
import { NO_SHOW_CONTACT_CHANNELS } from "@/lib/policy-fees/no-show-evidence";
import { policyFeeIdempotencyKey } from "@/lib/policy-fees/keys";
import { previewNoShowFee } from "@/lib/policy-fees/no-show-charge";
import { getStaffSession } from "@/lib/staff/auth";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireStaff() {
  const session = await getStaffSession();
  if ("error" in session) return session;
  return session;
}

export async function GET(request: Request) {
  const session = await requireStaff();
  if ("error" in session) return mapStaffServiceError(session.error);
  const appointmentId = new URL(request.url).searchParams.get("appointmentId");
  if (!appointmentId) return staffJsonError("Choose an appointment.", 400);
  const admin = createAdminClient();
  const { data: opened } = await admin
    .from("appointments")
    .select(
      "id, visit_id, appointment_date, scheduled_start, service_price, estimated_total, travel_fee, add_on_ids, add_on_options, status",
    )
    .eq("id", appointmentId)
    .maybeSingle();
  if (!opened?.visit_id) return staffJsonError("This appointment is not on a visit.", 404);
  const { data: rows } = await admin
    .from("appointments")
    .select(
      "id, visit_id, appointment_date, scheduled_start, service_price, estimated_total, travel_fee, add_on_ids, add_on_options, status",
    )
    .eq("visit_id", opened.visit_id)
    .neq("status", "cancelled");
  const active = rows ?? [];
  const [noShow, cancelFee, removeFee, evidence, coverage, legacy] = await Promise.all([
    previewNoShowFee(appointmentId),
    previewCustomerPolicyFee({
      action: "cancel",
      rows: active,
      visitId: opened.visit_id,
    }),
    previewCustomerPolicyFee({
      action: "remove_dog",
      rows: active.filter((row) => row.id === appointmentId),
      visitId: opened.visit_id,
    }),
    admin
      .from("visit_no_show_reports")
      .select("*")
      .eq("visit_id", opened.visit_id)
      .in("status", ["draft", "confirmed"])
      .maybeSingle(),
    admin
      .from("policy_fee_coverage")
      .select("id, appointment_id, component, active, release_reason")
      .eq("visit_id", opened.visit_id)
      .eq("active", true),
    admin
      .from("appointment_charges")
      .select("id, kind, status, total, refunded_amount, claim_id")
      .in(
        "appointment_id",
        active.map((row) => row.id),
      )
      .in("kind", ["cancellation", "no_show"]),
  ]);
  return NextResponse.json({
    visitId: opened.visit_id,
    noShow: "error" in noShow ? { message: "message" in noShow ? noShow.message : "Unavailable" } : noShow,
    cancelFee,
    removeFee,
    evidence: evidence.data,
    coverage: coverage.data ?? [],
    legacyCharges: legacy.data ?? [],
  });
}

export async function POST(request: Request) {
  const session = await requireStaff();
  if ("error" in session) return mapStaffServiceError(session.error);
  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action ?? "");
  const admin = createAdminClient();

  if (action === "save-no-show" || action === "confirm-no-show") {
    const visitId = String(body.visitId ?? "");
    const channel = String(body.contactChannel ?? "");
    if (!NO_SHOW_CONTACT_CHANNELS.includes(channel as never)) {
      return staffJsonError("Choose how you contacted the customer.", 400);
    }
    const record = {
      visit_id: visitId,
      arrived_at: String(body.arrivedAt ?? ""),
      contact_attempted_at: String(body.contactAttemptedAt ?? ""),
      contact_channel: channel,
      customer_replied: Boolean(body.customerReplied),
      handoff_arranged: Boolean(body.handoffArranged),
      note: typeof body.note === "string" ? body.note : null,
      recorded_by: session.user.id,
      status: "draft" as const,
    };
    const { data: existing } = await admin
      .from("visit_no_show_reports")
      .select("id, status")
      .eq("visit_id", visitId)
      .in("status", ["draft", "confirmed"])
      .maybeSingle();
    if (existing?.status === "confirmed") {
      return staffJsonError("Confirmed no-show evidence cannot be edited.", 409);
    }
    const saved = existing
      ? await admin.from("visit_no_show_reports").update(record).eq("id", existing.id).select("id").single()
      : await admin.from("visit_no_show_reports").insert(record).select("id").single();
    if (saved.error || !saved.data) {
      return staffJsonError("Could not save the no-show evidence.", 409);
    }
    if (action === "save-no-show") return NextResponse.json({ id: saved.data.id, status: "draft" });
    const { error } = await admin
      .from("visit_no_show_reports")
      .update({
        status: "confirmed",
        confirmed_by: session.user.id,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", saved.data.id);
    if (error) {
      return staffJsonError(
        "No-show can be confirmed only after a 15-minute wait with no reply and no handoff.",
        409,
      );
    }
    return NextResponse.json({ id: saved.data.id, status: "confirmed" });
  }

  if (action === "authorize-waiver") {
    const { data, error } = await admin.rpc("authorize_policy_fee_waiver", {
      p_input: {
        idempotency_key: String(body.idempotencyKey ?? ""),
        visit_id: String(body.visitId ?? ""),
        action: String(body.feeAction ?? ""),
        appointment_id: body.appointmentId ? String(body.appointmentId) : null,
        collect_cap: Number(body.collectCap),
        reason: String(body.reason ?? ""),
        actor_id: session.user.id,
      },
    });
    if (error) return staffJsonError("Could not save this fixed cap.", 409);
    const outcome = String((data as { outcome?: string } | null)?.outcome ?? "");
    if (outcome === "already_settled") {
      return staffJsonError("This fee is already charging or paid. Use a refund instead.", 409);
    }
    if (outcome !== "authorized") return staffJsonError("Enter a fixed dollar cap and a reason.", 400);
    return NextResponse.json(data);
  }

  if (action === "review-legacy") {
    const { data, error } = await admin.rpc("review_legacy_policy_charge", {
      p_input: {
        charge_id: String(body.chargeId ?? ""),
        visit_id: String(body.visitId ?? ""),
        classification: String(body.classification ?? ""),
        covers_travel: Boolean(body.coversTravel),
        appointment_ids: Array.isArray(body.appointmentIds) ? body.appointmentIds : [],
        reason: String(body.reason ?? ""),
        actor_id: session.user.id,
      },
    });
    if (error) return staffJsonError("Could not review that older fee.", 409);
    return NextResponse.json(data);
  }

  if (action === "reopen-coverage") {
    const { data, error } = await admin.rpc("reopen_policy_fee_coverage", {
      p_input: {
        visit_id: String(body.visitId ?? ""),
        action: String(body.feeAction ?? ""),
        base_key: String(body.baseKey ?? ""),
        coverage_ids: Array.isArray(body.coverageIds) ? body.coverageIds : [],
        reason: String(body.reason ?? ""),
        actor_id: session.user.id,
      },
    });
    if (error) return staffJsonError("Could not reopen that coverage.", 409);
    const outcome = String((data as { outcome?: string } | null)?.outcome ?? "");
    if (outcome !== "authorized") {
      return staffJsonError("Choose active coverage and enter a business reason.", 409);
    }
    return NextResponse.json(data);
  }

  if (action === "no-show-key") {
    return NextResponse.json({
      idempotencyKey: policyFeeIdempotencyKey({
        action: "no_show",
        visitId: String(body.visitId ?? ""),
      }),
    });
  }

  return staffJsonError("Unknown fee action.", 400);
}
