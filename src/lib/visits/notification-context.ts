import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import type { VisitNoticePet } from "@/lib/visits/notification-scope";

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function loadVisitNoticePets(
  visitId: string,
): Promise<VisitNoticePet[] | null> {
  if (!hasSupabaseAdminConfig()) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select(
      "id, status, service_name, service_ended_at, visit_sequence, pets ( name, sex )",
    )
    .eq("visit_id", visitId)
    .order("visit_sequence", { ascending: true });

  if (error) {
    console.error("loadVisitNoticePets failed:", error.message);
    return null;
  }

  return (data ?? []).map((row) => {
    const pet = firstRelation(
      row.pets as { name: string | null; sex: string | null } | { name: string | null; sex: string | null }[] | null,
    );
    return {
      id: row.id as string,
      petName: pet?.name?.trim() || "Dog",
      serviceName: (row.service_name as string | null)?.trim() || "Service",
      status: row.status as string,
      serviceEndedAt: (row.service_ended_at as string | null) ?? null,
      sex: pet?.sex ?? null,
    };
  });
}
