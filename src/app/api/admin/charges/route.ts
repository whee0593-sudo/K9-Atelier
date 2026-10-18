import { NextResponse } from "next/server";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { createAppointmentCharge } from "@/lib/charges/service";
import { chargeNoShow } from "@/lib/policy-fees/no-show-charge";
import type { ChargeKind, ChargeTender } from "@/lib/charges/types";
import { readChargeTender } from "@/lib/charges/tender";

export async function POST(request: Request) {
  let body: {
    appointmentId?: string;
    kind?: ChargeKind;
    lineItems?: unknown;
    tipAmount?: number;
    paymentMethodId?: string;
    useNewCard?: boolean;
    tender?: ChargeTender;
    referralMode?: "full" | "custom" | "none";
    referralCustomDollars?: number;
    referralCode?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return staffJsonError("Invalid request.", 400);
  }

  if (!body.appointmentId || (body.kind !== "service" && body.kind !== "no_show")) {
    return staffJsonError("Choose an appointment and charge type.", 400);
  }

  if (body.kind === "no_show") {
    const noShow = await chargeNoShow({
      appointmentId: body.appointmentId,
      tender: readChargeTender(body.tender),
      paymentMethodId: body.paymentMethodId,
      useNewCard: Boolean(body.useNewCard),
    });
    if ("error" in noShow) {
      if (
        noShow.error === "declined" ||
        noShow.error === "pending" ||
        noShow.error === "needs_review"
      ) {
        return NextResponse.json(
          {
            error:
              "message" in noShow ? noShow.message : "This card could not be charged.",
            paymentState: "paymentState" in noShow ? noShow.paymentState : null,
          },
          { status: 409 },
        );
      }
      if (noShow.error === "conflict" && "message" in noShow && noShow.message) {
        return staffJsonError(noShow.message, 409);
      }
      if (
        noShow.error === "unauthenticated" ||
        noShow.error === "forbidden" ||
        noShow.error === "misconfigured"
      ) {
        return mapStaffServiceError(noShow.error);
      }
      return mapStaffServiceError("server");
    }
    return NextResponse.json(noShow);
  }

  const result = await createAppointmentCharge({
    appointmentId: body.appointmentId,
    kind: body.kind,
    lineItems: (body.lineItems ?? []) as never,
    tipAmount: Number(body.tipAmount ?? 0),
    paymentMethodId: body.paymentMethodId,
    useNewCard: Boolean(body.useNewCard),
    tender: readChargeTender(body.tender),
    referralMode: body.referralMode,
    referralCustomDollars: body.referralCustomDollars,
    referralCode: body.referralCode,
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
