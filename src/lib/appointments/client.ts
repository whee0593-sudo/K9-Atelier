import type { BookingPriceQuote } from "@/lib/booking-price";
import type { AppointmentRecord } from "@/lib/appointments/types";

export class AppointmentClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly quote?: BookingPriceQuote;

  constructor(
    message: string,
    status: number,
    details?: { code?: string; quote?: BookingPriceQuote },
  ) {
    super(message);
    this.name = "AppointmentClientError";
    this.status = status;
    this.code = details?.code;
    this.quote = details?.quote;
  }
}

async function readAppointmentResponse<T>(response: Response): Promise<T> {
  let body: {
    error?: string;
    code?: string;
    field?: string;
    quote?: BookingPriceQuote;
    appointment?: AppointmentRecord;
    appointments?: AppointmentRecord[];
    ok?: boolean;
  };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    body = {};
  }

  if (!response.ok) {
    throw new AppointmentClientError(
      body.error ?? "Something went wrong. Please try again.",
      response.status,
      {
        code:
          body.code ??
          (body.field === "estimatedTotal" ? "price_changed" : undefined),
        quote:
          body.quote && typeof body.quote.estimatedTotal === "number"
            ? body.quote
            : undefined,
      },
    );
  }

  return body as T;
}

export async function createCustomerAppointment(
  input: Record<string, unknown>,
): Promise<AppointmentRecord> {
  const response = await fetch("/api/appointments", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readAppointmentResponse<{ appointment: AppointmentRecord }>(
    response,
  );
  return body.appointment;
}

export async function fetchCustomerAppointments(): Promise<AppointmentRecord[]> {
  const response = await fetch("/api/appointments", { credentials: "include" });
  const body = await readAppointmentResponse<{ appointments: AppointmentRecord[] }>(
    response,
  );
  return body.appointments;
}
