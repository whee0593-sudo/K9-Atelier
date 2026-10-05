import {
  availabilityBlockConflictMessage,
  normalizeAvailabilityBlockInput,
  type AvailabilityBlock,
  type AvailabilityBlockDraft,
} from "@/lib/appointments/availability-blocks";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig, hasSupabaseConfig } from "@/lib/supabase/env";

type StoreError = {
  error: "misconfigured" | "server" | "not_found" | "conflict" | "invalid";
  message?: string;
};

type BlockRow = {
  id: string;
  service_date: string;
  all_day: boolean;
  start_minutes: number | null;
  end_minutes: number | null;
  reason: string | null;
};

function adminClient() {
  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) return null;
  return createAdminClient();
}

function mapBlock(row: BlockRow): AvailabilityBlock {
  return {
    id: row.id,
    serviceDate: row.service_date,
    allDay: Boolean(row.all_day),
    startMinutes:
      typeof row.start_minutes === "number" ? row.start_minutes : null,
    endMinutes: typeof row.end_minutes === "number" ? row.end_minutes : null,
    reason: typeof row.reason === "string" && row.reason.trim() ? row.reason : null,
  };
}

const BLOCK_COLUMNS =
  "id, service_date, all_day, start_minutes, end_minutes, reason";

export async function loadAvailabilityBlocks(
  fromDate: string,
  toDate: string,
): Promise<{ blocks: AvailabilityBlock[] } | StoreError> {
  const admin = adminClient();
  if (!admin) return { blocks: [] };

  const { data, error } = await admin
    .from("admin_availability_blocks")
    .select(BLOCK_COLUMNS)
    .gte("service_date", fromDate)
    .lte("service_date", toDate)
    .order("service_date", { ascending: true })
    .order("all_day", { ascending: false })
    .order("start_minutes", { ascending: true });

  if (error) {
    console.error("loadAvailabilityBlocks failed:", error.message);
    return { error: "server" };
  }

  return { blocks: ((data ?? []) as BlockRow[]).map(mapBlock) };
}

async function blocksOnDate(serviceDate: string) {
  const loaded = await loadAvailabilityBlocks(serviceDate, serviceDate);
  if ("error" in loaded) return loaded;
  return { blocks: loaded.blocks };
}

function rowFromDraft(draft: AvailabilityBlockDraft) {
  return {
    service_date: draft.serviceDate,
    all_day: draft.allDay,
    start_minutes: draft.startMinutes,
    end_minutes: draft.endMinutes,
    reason: draft.reason,
  };
}

export async function createAvailabilityBlock(input: {
  serviceDate?: string;
  allDay?: boolean;
  startMinutes?: number | null;
  endMinutes?: number | null;
  reason?: string | null;
}): Promise<{ block: AvailabilityBlock } | StoreError> {
  const normalized = normalizeAvailabilityBlockInput(input);
  if (!normalized.ok) return { error: "invalid", message: normalized.error };

  const existing = await blocksOnDate(normalized.value.serviceDate);
  if ("error" in existing) return existing;
  const conflict = availabilityBlockConflictMessage(
    existing.blocks,
    normalized.value,
  );
  if (conflict) return { error: "conflict", message: conflict };

  const admin = adminClient();
  if (!admin) return { error: "misconfigured" };

  const { data, error } = await admin
    .from("admin_availability_blocks")
    .insert(rowFromDraft(normalized.value))
    .select(BLOCK_COLUMNS)
    .single();

  if (error || !data) {
    console.error("createAvailabilityBlock failed:", error?.message);
    return { error: "server" };
  }
  return { block: mapBlock(data as BlockRow) };
}

export async function updateAvailabilityBlock(
  id: string,
  input: {
    allDay?: boolean;
    startMinutes?: number | null;
    endMinutes?: number | null;
    reason?: string | null;
  },
): Promise<{ block: AvailabilityBlock } | StoreError> {
  const admin = adminClient();
  if (!admin) return { error: "misconfigured" };

  const currentResult = await admin
    .from("admin_availability_blocks")
    .select(BLOCK_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (currentResult.error) {
    console.error("updateAvailabilityBlock load failed:", currentResult.error.message);
    return { error: "server" };
  }
  if (!currentResult.data) return { error: "not_found" };

  const current = mapBlock(currentResult.data as BlockRow);
  const normalized = normalizeAvailabilityBlockInput({
    serviceDate: current.serviceDate,
    allDay: input.allDay ?? current.allDay,
    startMinutes:
      input.allDay === true
        ? null
        : (input.startMinutes ?? current.startMinutes),
    endMinutes:
      input.allDay === true ? null : (input.endMinutes ?? current.endMinutes),
    reason: input.reason === undefined ? current.reason : input.reason,
  });
  if (!normalized.ok) return { error: "invalid", message: normalized.error };

  const existing = await blocksOnDate(current.serviceDate);
  if ("error" in existing) return existing;
  const conflict = availabilityBlockConflictMessage(
    existing.blocks,
    normalized.value,
    id,
  );
  if (conflict) return { error: "conflict", message: conflict };

  const { data, error } = await admin
    .from("admin_availability_blocks")
    .update(rowFromDraft(normalized.value))
    .eq("id", id)
    .select(BLOCK_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    console.error("updateAvailabilityBlock failed:", error?.message);
    return { error: "server" };
  }
  return { block: mapBlock(data as BlockRow) };
}

export async function deleteAvailabilityBlock(
  id: string,
): Promise<{ ok: true } | StoreError> {
  const admin = adminClient();
  if (!admin) return { error: "misconfigured" };

  const { data, error } = await admin
    .from("admin_availability_blocks")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("deleteAvailabilityBlock failed:", error.message);
    return { error: "server" };
  }
  if (!data || data.length === 0) return { error: "not_found" };
  return { ok: true };
}
