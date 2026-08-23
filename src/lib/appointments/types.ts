import type { VaccinationBookingStatus } from "@/lib/vaccinations/types";

export type AppointmentStatus =
  | "pending_confirmation"
  | "confirmed"
  | "cancelled";

export type AppointmentWriteInput = {
  petId: string;
  serviceId: string;
  serviceName: string;
  addOnIds: string[];
  addOnOptions: Record<string, string>;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  travelDistanceMiles: number;
  travelFee: number;
  appointmentDate: string;
  appointmentTime: string;
  timePreference: "morning" | "afternoon";
  addressLat: number;
  addressLon: number;
  estimatedTotal: number;
  paymentMethodId: string;
  customerPhone: string;
};

export type AppointmentRecord = {
  id: string;
  customerId: string;
  petId: string;
  petName: string;
  petBreed: string;
  serviceId: string;
  serviceName: string;
  addOnIds: string[];
  addOnOptions: Record<string, string>;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  travelDistanceMiles: number;
  travelFee: number;
  appointmentDate: string;
  appointmentTime: string;
  scheduledStart: number | null;
  timePreference: "morning" | "afternoon" | null;
  timezone: string;
  estimatedTotal: number | null;
  newClientDeposit: number | null;
  vaccinationStatusAtBooking: VaccinationBookingStatus | null;
  status: AppointmentStatus;
  confirmedAt: string | null;
  createdAt: string;
};

export type AdminAppointmentRecord = AppointmentRecord & {
  customerEmail: string;
  customerName: string | null;
  customerFirstName: string | null;
  customerPhone: string | null;
  reminderSmsSentAt: string | null;
  enRouteSmsSentAt: string | null;
  serviceStartedAt: string | null;
  serviceEndedAt: string | null;
};

export type AppointmentRow = {
  id: string;
  customer_id: string;
  pet_id: string;
  service_id: string;
  service_name: string;
  add_on_ids: string[];
  add_on_options: Record<string, string> | null;
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  travel_distance_miles: number;
  travel_fee: number;
  appointment_date: string;
  appointment_time: string;
  scheduled_start?: number | null;
  time_preference?: "morning" | "afternoon" | null;
  address_lat?: number | null;
  address_lon?: number | null;
  timezone: string;
  estimated_total: number | null;
  new_client_deposit: number | null;
  vaccination_status_at_booking: string | null;
  status: AppointmentStatus;
  confirmed_at: string | null;
  created_at: string;
  reminder_sms_sent_at?: string | null;
  en_route_sms_sent_at?: string | null;
  service_started_at?: string | null;
  service_ended_at?: string | null;
  pets?: { name: string; breed: string } | { name: string; breed: string }[] | null;
  profiles?: {
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | {
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  }[] | null;
};
