export type CustomerProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  preferredContact: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
};

export type CustomerProfileWriteInput = {
  firstName: string;
  lastName: string;
  phone: string;
  preferredContact: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
};

export type CustomerProfileRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  preferred_contact: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
};

export const PREFERRED_CONTACT_OPTIONS = [
  "Email",
  "Phone",
  "Text Message",
] as const;

export const EMERGENCY_RELATIONSHIP_OPTIONS = [
  "Spouse",
  "Partner",
  "Family",
  "Friend",
  "Neighbor",
  "Other",
] as const;

export function mapProfileRow(row: CustomerProfileRow): CustomerProfile {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    phone: row.phone ?? "",
    preferredContact: row.preferred_contact ?? "",
    emergencyContactName: row.emergency_contact_name ?? "",
    emergencyContactPhone: row.emergency_contact_phone ?? "",
    emergencyContactRelationship: row.emergency_contact_relationship ?? "",
  };
}
