import { createClient } from "@/lib/supabase/server";
import { VACCINATION_BUCKET } from "@/lib/vaccinations/types";

export type PendingVaccinationRecord = {
  id: string;
  petId: string;
  petName: string;
  petBreed: string;
  customerEmail: string;
  customerName: string | null;
  originalFilename: string | null;
  mimeType: string;
  expirationDate: string | null;
  createdAt: string;
  fileSizeBytes: number;
};

type PetJoin = { name: string; breed: string };
type ProfileJoin = {
  email: string;
  first_name: string | null;
  last_name: string | null;
};

type PendingRow = {
  id: string;
  pet_id: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string;
  expiration_date: string | null;
  created_at: string;
  file_size_bytes: number;
  pets: PetJoin | PetJoin[] | null;
  profiles: ProfileJoin | ProfileJoin[] | null;
};

function firstRelation<T>(value: T | T[] | null): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapPendingRow(row: PendingRow): PendingVaccinationRecord {
  const pet = firstRelation(row.pets);
  const profile = firstRelation(row.profiles);
  const nameParts = [profile?.first_name, profile?.last_name].filter(Boolean);

  return {
    id: row.id,
    petId: row.pet_id,
    petName: pet?.name ?? "Unknown pet",
    petBreed: pet?.breed ?? "",
    customerEmail: profile?.email ?? "",
    customerName: nameParts.length > 0 ? nameParts.join(" ") : null,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    expirationDate: row.expiration_date,
    createdAt: row.created_at,
    fileSizeBytes: row.file_size_bytes,
  };
}

export async function listPendingVaccinationRecords(): Promise<
  | { records: PendingVaccinationRecord[] }
  | { error: "unauthenticated" | "forbidden" | "server" }
> {
  const { getStaffSession } = await import("@/lib/staff/auth");
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pet_vaccination_records")
    .select(
      `
      id,
      pet_id,
      storage_path,
      original_filename,
      mime_type,
      expiration_date,
      created_at,
      file_size_bytes,
      pets ( name, breed ),
      profiles ( email, first_name, last_name )
    `,
    )
    .eq("verification_status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("listPendingVaccinationRecords failed:", error.code, error.message);
    return { error: "server" };
  }

  return {
    records: ((data ?? []) as PendingRow[]).map(mapPendingRow),
  };
}

export async function setVaccinationVerificationStatus(
  recordId: string,
  status: "verified" | "rejected",
): Promise<
  | { ok: true }
  | { error: "unauthenticated" | "forbidden" | "not_found" | "server" }
> {
  const { getStaffSession } = await import("@/lib/staff/auth");
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_set_vaccination_verification", {
    p_record_id: recordId,
    p_status: status,
  });

  if (error) {
    console.error(
      "setVaccinationVerificationStatus failed:",
      error.code,
      error.message,
    );
    if (error.message.includes("not found")) return { error: "not_found" };
    if (error.message.includes("not authorized")) return { error: "forbidden" };
    return { error: "server" };
  }

  if (!data) return { error: "not_found" };
  return { ok: true };
}

export async function createVaccinationFileSignedUrl(recordId: string): Promise<
  | { url: string; mimeType: string; filename: string | null }
  | { error: "unauthenticated" | "forbidden" | "not_found" | "server" }
> {
  const { getStaffSession } = await import("@/lib/staff/auth");
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };

  const supabase = await createClient();
  const { data: record, error: recordError } = await supabase
    .from("pet_vaccination_records")
    .select("storage_path, mime_type, original_filename")
    .eq("id", recordId)
    .maybeSingle();

  if (recordError) {
    console.error("createVaccinationFileSignedUrl lookup failed:", recordError.message);
    return { error: "server" };
  }
  if (!record) return { error: "not_found" };

  const { data: signed, error: signError } = await supabase.storage
    .from(VACCINATION_BUCKET)
    .createSignedUrl(record.storage_path, 120);

  if (signError || !signed?.signedUrl) {
    console.error(
      "createVaccinationFileSignedUrl sign failed:",
      signError?.message ?? "missing url",
    );
    return { error: "server" };
  }

  return {
    url: signed.signedUrl,
    mimeType: record.mime_type,
    filename: record.original_filename,
  };
}
