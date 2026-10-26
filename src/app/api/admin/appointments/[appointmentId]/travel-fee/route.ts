import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/staff/auth";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateAppointmentId } from "@/lib/appointments/validation";
import { calculateTravelFee } from "@/lib/travel";
import { parseTravelFeeOverride } from "@/lib/visits/travel-fee";

type Context = { params: Promise<{ appointmentId: string }> };

function automaticAmount(visit: { travel_fee_automatic: number | null; travel_distance_miles: number }) {
  // Keep the original full-precision GPS quote. The legacy distance column is
  // rounded to a tenth of a mile and can otherwise change the fee by a dollar.
  return visit.travel_fee_automatic == null
    ? calculateTravelFee(Number(visit.travel_distance_miles)).fee
    : Number(visit.travel_fee_automatic);
}

async function load(context: Context) {
  const session = await getStaffSession();
  if ("error" in session) return { response: mapStaffServiceError(session.error) };
  let id: string;
  try { id = validateAppointmentId((await context.params).appointmentId); }
  catch { return { response: mapStaffServiceError("not_found") }; }
  const admin = createAdminClient();
  const appointment = await admin.from("appointments").select("visit_id").eq("id", id).maybeSingle();
  if (appointment.error) return { response: mapStaffServiceError("server") };
  if (!appointment.data?.visit_id) return { response: mapStaffServiceError("not_found") };
  const visit = await admin.from("visits")
    .select("id, travel_distance_miles, travel_fee, travel_fee_automatic, travel_fee_override")
    .eq("id", appointment.data.visit_id).maybeSingle();
  if (visit.error) return { response: mapStaffServiceError("server") };
  if (!visit.data) return { response: mapStaffServiceError("not_found") };
  return { admin, visit: visit.data };
}

export async function GET(_request: Request, context: Context) {
  const loaded = await load(context);
  if (loaded.response) return loaded.response;
  const { visit } = loaded;
  return NextResponse.json({
    automatic: automaticAmount(visit),
    override: visit.travel_fee_override == null ? null : Number(visit.travel_fee_override),
    effective: Number(visit.travel_fee),
  });
}

export async function PATCH(request: Request, context: Context) {
  const loaded = await load(context);
  if (loaded.response) return loaded.response;
  let override: number | null;
  try {
    const body = await request.json();
    if (!body || !Object.hasOwn(body, "override")) throw new Error("Choose an amount or restore automatic calculation.");
    override = parseTravelFeeOverride(body.override);
  } catch (error) { return staffJsonError((error as Error).message, 400); }
  const automatic = automaticAmount(loaded.visit);
  const { error } = await loaded.admin.rpc("set_visit_travel_fee", {
    p_visit_id: loaded.visit.id, p_automatic: automatic, p_override: override,
  });
  if (error) {
    if (error.code === "23514") return staffJsonError("Travel fee cannot change after payment has started.", 409);
    if (error.code === "P0002") return mapStaffServiceError("conflict");
    console.error("set_visit_travel_fee failed:", error.code);
    return mapStaffServiceError("server");
  }
  return NextResponse.json({ automatic, override, effective: override ?? automatic });
}
