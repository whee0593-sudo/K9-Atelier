import type { AppointmentRecord } from "@/lib/appointments/types";

export class AppointmentClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AppointmentClientError";
    this.status = status;
  }
}

async function readAppointmentResponse<T>(response: Response): Promise<T> {
  let body: { error?: string; appointment?: AppointmentRecord; appointments?: AppointmentRecord[]; ok?: boolean };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    body = {};
  }

  if (!response.ok) {
    throw new AppointmentClientError(
      body.error ?? "Something went wrong. Please try again.",
      response.status,
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
