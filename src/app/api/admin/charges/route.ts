import { NextResponse } from "next/server";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { createAppointmentCharge } from "@/lib/charges/service";
import type { ChargeKind } from "@/lib/charges/types";

export async function POST(request: Request) {
  let body: {
    appointmentId?: string;
    kind?: ChargeKind;
    lineItems?: unknown;
    tipAmount?: number;
    paymentMethodId?: string;
    useNewCard?: boolean;
    referralMode?: "full" | "custom" | "none";
    referralCustomDollars?: number;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return staffJsonError("Invalid request.", 400);
  }

  if (!body.appointmentId || (body.kind !== "service" && body.kind !== "no_show")) {
    return staffJsonError("Choose an appointment and charge type.", 400);
  }

  const result = await createAppointmentCharge({
    appointmentId: body.appointmentId,
    kind: body.kind,
    lineItems: (body.lineItems ?? []) as never,
    tipAmount: Number(body.tipAmount ?? 0),
    paymentMethodId: body.paymentMethodId,
    useNewCard: Boolean(body.useNewCard),
    referralMode: body.referralMode,
    referralCustomDollars: body.referralCustomDollars,
  });

  if ("error" in result) {
    if (result.error === "declined") {
      return staffJsonError(result.message ?? "This card could not be charged.", 409);
    }
    if (result.error === "conflict" && result.message) {
      return staffJsonError(result.message, 409);
    }
    return mapStaffServiceError(result.error);
  }

  return NextResponse.json(result);
}
