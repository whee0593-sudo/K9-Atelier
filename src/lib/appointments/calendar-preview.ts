import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import type { AdminCalendarDay } from "@/lib/appointments/calendar";
import type { ChargeKind } from "@/lib/charges/types";

const TIMEZONE = "America/New_York";
export const PREVIEW_CALENDAR_MONTH = "2026-07";

function lastDayOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function previewAppointment(
  patch: Partial<AdminAppointmentRecord> &
    Pick<
      AdminAppointmentRecord,
      "id" | "petName" | "customerName" | "serviceName" | "appointmentTime"
    >,
): AdminAppointmentRecord {
  return {
    customerId: "preview-customer",
    petId: "preview-pet",
    petBreed: "Cavapoo",
    serviceId: "signature-bath-care",
    addOnIds: [],
    addOnOptions: {},
    addressStreet: "1408 14th Lane",
    addressCity: "Palm Beach Gardens",
    addressState: "FL",
    addressZip: "33418",
    travelDistanceMiles: 8,
    travelFee: 0,
    appointmentDate: "2026-08-22",
    scheduledStart: null,
    timePreference: "morning",
    timezone: TIMEZONE,
    estimatedTotal: 140,
    newClientDeposit: null,
    vaccinationStatusAtBooking: null,
    status: "confirmed",
    confirmedAt: "2026-08-20T14:00:00.000Z",
    customerConfirmedAt: null,
    createdAt: "2026-08-20T14:00:00.000Z",
    customerEmail: "alex@example.com",
    customerFirstName: "Alex",
    customerLastName: null,
    customerPhone: "+15615550123",
    reminderSmsSentAt: null,
    enRouteSmsSentAt: null,
    serviceStartedAt: null,
    serviceEndedAt: null,
    ...patch,
  };
}

export function buildPreviewCalendarMonth(month: string): {
  month: string;
  today: string;
  days: AdminCalendarDay[];
} {
  const today = "2026-08-22";
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const last = lastDayOfMonth(year, monthIndex);
  const counts: Record<string, number> = {
    "2026-07-08": 2,
    "2026-07-14": 3,
    "2026-07-17": 2,
    "2026-07-23": 4,
    "2026-08-22": 2,
    "2026-08-25": 4,
    "2026-08-28": 1,
    "2026-09-21": 2,
    "2026-09-22": 4,
    "2026-09-24": 1,
  };

  const days: AdminCalendarDay[] = [];
  for (let day = 1; day <= last; day += 1) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const appointmentCount = counts[date] ?? 0;
    days.push({
      date,
      appointmentCount,
      isPast: date < today,
      isFull: appointmentCount >= 4,
      isToday: date === today,
    });
  }

  return { month, today, days };
}

function completedVisit(
  date: string,
  startedAt: string,
  endedAt: string,
) {
  return {
    appointmentDate: date,
    confirmedAt: `${date}T12:00:00.000Z`,
    createdAt: `${date}T12:00:00.000Z`,
    serviceStartedAt: startedAt,
    serviceEndedAt: endedAt,
  };
}

export function buildPreviewPaidKinds(
  appointments: AdminAppointmentRecord[],
): Record<string, ChargeKind[]> {
  return Object.fromEntries(
    appointments
      .filter((appointment) => appointment.serviceStartedAt && appointment.serviceEndedAt)
      .map((appointment) => [appointment.id, ["service"] as ChargeKind[]]),
  );
}

export function buildPreviewCalendarAppointments(
  date: string,
): AdminAppointmentRecord[] {
  if (date === "2026-07-08") {
    return [
      previewAppointment({
        id: "preview-daisy",
        petName: "Daisy",
        petBreed: "Goldendoodle",
        customerName: "Maya Patel",
        customerFirstName: "Maya",
        customerEmail: "maya@example.com",
        customerPhone: "+15615550131",
        serviceName: "Signature Bath & Care",
        appointmentTime: "09:00",
        estimatedTotal: 140,
        customerConfirmedAt: `${date}T13:00:00.000Z`,
        ...completedVisit(date, `${date}T13:08:00.000Z`, `${date}T15:02:00.000Z`),
      }),
      previewAppointment({
        id: "preview-scout",
        petName: "Scout",
        petBreed: "Mini Schnauzer",
        customerName: "Chris Alvarez",
        customerFirstName: "Chris",
        customerEmail: "chris@example.com",
        customerPhone: "+15615550132",
        serviceName: "Hand Stripping Specialty",
        appointmentTime: "12:30",
        estimatedTotal: 225,
        ...completedVisit(date, `${date}T16:36:00.000Z`, `${date}T18:40:00.000Z`),
      }),
    ];
  }

  if (date === "2026-07-14") {
    return [
      previewAppointment({
        id: "preview-pepper",
        petName: "Pepper",
        petBreed: "Shih Tzu",
        customerName: "Nina Volk",
        customerFirstName: "Nina",
        customerEmail: "nina@example.com",
        customerPhone: "+15615550133",
        serviceName: "Long Coat Show Care",
        appointmentTime: "09:30",
        estimatedTotal: 140,
        ...completedVisit(date, `${date}T13:34:00.000Z`, `${date}T15:18:00.000Z`),
      }),
      previewAppointment({
        id: "preview-milo",
        petName: "Milo",
        petBreed: "Cavapoo",
        customerName: "Elena Ward",
        customerFirstName: "Elena",
        customerEmail: "elena@example.com",
        customerPhone: "+15615550134",
        serviceName: "Signature Bath & Care",
        appointmentTime: "11:30",
        estimatedTotal: 140,
        ...completedVisit(date, `${date}T15:31:00.000Z`, `${date}T17:05:00.000Z`),
      }),
      previewAppointment({
        id: "preview-cleo",
        petName: "Cleo",
        petBreed: "Poodle",
        customerName: "Ben Ortiz",
        customerFirstName: "Ben",
        customerEmail: "ben@example.com",
        customerPhone: "+15615550135",
        serviceName: "Creative Accent Coloring",
        appointmentTime: "14:00",
        estimatedTotal: 165,
        ...completedVisit(date, `${date}T18:06:00.000Z`, `${date}T20:22:00.000Z`),
      }),
    ];
  }

  if (date === "2026-07-17") {
    return [
      previewAppointment({
        id: "preview-hugo",
        petName: "Hugo",
        petBreed: "Yorkie",
        customerName: "Priya Shah",
        customerFirstName: "Priya",
        customerEmail: "priya@example.com",
        customerPhone: "+15615550136",
        serviceName: "Signature Bath & Care",
        appointmentTime: "10:00",
        estimatedTotal: 140,
        ...completedVisit(date, `${date}T14:04:00.000Z`, `${date}T15:48:00.000Z`),
      }),
      previewAppointment({
        id: "preview-rex-pending",
        petName: "Rex",
        petBreed: "Cavapoo",
        customerName: "Jamie Cole",
        customerFirstName: "Jamie",
        customerEmail: "jamie@example.com",
        customerPhone: "+15615550145",
        serviceName: "Signature Bath & Care",
        appointmentTime: "1:00–3:00 PM",
        appointmentDate: date,
        estimatedTotal: 140,
        status: "pending_confirmation",
        confirmedAt: null,
        vaccinationStatusAtBooking: "needs_review",
      }),
    ];
  }

  if (date === "2026-07-23") {
    return [
      previewAppointment({
        id: "preview-nala",
        petName: "Nala",
        petBreed: "Maltese",
        customerName: "Owen Blake",
        customerFirstName: "Owen",
        customerEmail: "owen@example.com",
        customerPhone: "+15615550137",
        serviceName: "Signature Bath & Care",
        appointmentTime: "09:00",
        estimatedTotal: 140,
        ...completedVisit(date, `${date}T13:05:00.000Z`, `${date}T14:50:00.000Z`),
      }),
      previewAppointment({
        id: "preview-gus",
        petName: "Gus",
        petBreed: "Bichon",
        customerName: "Harper Diaz",
        customerFirstName: "Harper",
        customerEmail: "harper@example.com",
        customerPhone: "+15615550138",
        serviceName: "Long Coat Show Care",
        appointmentTime: "10:45",
        estimatedTotal: 140,
        ...completedVisit(date, `${date}T14:48:00.000Z`, `${date}T16:33:00.000Z`),
      }),
      previewAppointment({
        id: "preview-pip",
        petName: "Pip",
        petBreed: "Yorkie",
        customerName: "Ivy Chen",
        customerFirstName: "Ivy",
        customerEmail: "ivy@example.com",
        customerPhone: "+15615550139",
        serviceName: "Signature Bath & Care",
        appointmentTime: "12:30",
        estimatedTotal: 140,
        ...completedVisit(date, `${date}T16:36:00.000Z`, `${date}T18:10:00.000Z`),
      }),
      previewAppointment({
        id: "preview-stella",
        petName: "Stella",
        petBreed: "Poodle",
        customerName: "Noah Kim",
        customerFirstName: "Noah",
        customerEmail: "noah@example.com",
        customerPhone: "+15615550140",
        serviceName: "Creative Accent Coloring",
        appointmentTime: "14:15",
        estimatedTotal: 165,
        ...completedVisit(date, `${date}T18:20:00.000Z`, `${date}T20:05:00.000Z`),
      }),
    ];
  }

  if (date === "2026-08-22" || date === "2026-09-21") {
    return [
      previewAppointment({
        id: "preview-maple",
        petName: "Maple",
        customerName: "Alex Rivera",
        serviceName: "Signature Bath & Care",
        appointmentTime: "10:00",
        appointmentDate: date,
        serviceStartedAt: `${date}T14:12:00.000Z`,
        serviceEndedAt: `${date}T16:05:00.000Z`,
      }),
      previewAppointment({
        id: "preview-otto",
        petName: "Otto",
        petBreed: "Schnauzer",
        customerName: "Jordan Ellis",
        serviceName: "Hand Stripping Specialty",
        appointmentTime: "13:00",
        appointmentDate: date,
        estimatedTotal: 150,
        serviceStartedAt: `${date}T17:02:00.000Z`,
        serviceEndedAt: null,
      }),
    ];
  }

  if (date === "2026-08-25" || date === "2026-09-22") {
    return [
      previewAppointment({
        id: "preview-cocoa",
        petName: "Cocoa",
        petBreed: "Poodle",
        customerName: "Riley Brooks",
        serviceName: "Signature Bath & Care",
        appointmentTime: "09:00",
        appointmentDate: date,
        estimatedTotal: 140,
      }),
      previewAppointment({
        id: "preview-bean",
        petName: "Bean",
        petBreed: "Yorkie",
        customerName: "Casey Nguyen",
        serviceName: "Creative Accent Coloring",
        appointmentTime: "10:30",
        appointmentDate: date,
        estimatedTotal: 165,
      }),
      previewAppointment({
        id: "preview-olive",
        petName: "Olive",
        petBreed: "Bichon",
        customerName: "Morgan Hale",
        serviceName: "Long Coat Show Care",
        appointmentTime: "12:30",
        appointmentDate: date,
        estimatedTotal: 140,
      }),
      previewAppointment({
        id: "preview-winnie",
        petName: "Winnie",
        petBreed: "Maltese",
        customerName: "Taylor Quinn",
        serviceName: "Signature Bath & Care",
        appointmentTime: "14:30",
        appointmentDate: date,
        estimatedTotal: 140,
      }),
    ];
  }

  if (date === "2026-08-28" || date === "2026-09-24") {
    return [
      previewAppointment({
        id: "preview-lulu",
        petName: "Lulu",
        petBreed: "Maltese",
        customerName: "Sam Chen",
        serviceName: "Long Coat Show Care",
        appointmentTime: "11:00",
        appointmentDate: date,
        estimatedTotal: 140,
      }),
    ];
  }

  return [];
}
