const PREVIEW_STORAGE_KEY = "k9-preview-customer-admin-notes";

function canUsePreviewStorage() {
  return typeof sessionStorage !== "undefined";
}

function readPreviewMap(): Record<string, string> {
  if (!canUsePreviewStorage()) return {};
  try {
    const raw = sessionStorage.getItem(PREVIEW_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export function getPreviewCustomerAdminNotes(customerId: string): string {
  const value = readPreviewMap()[customerId];
  return typeof value === "string" ? value : "";
}

export function setPreviewCustomerAdminNotes(customerId: string, notes: string) {
  if (!canUsePreviewStorage()) return;
  const next = { ...readPreviewMap(), [customerId]: notes };
  sessionStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(next));
}

export async function loadCustomerAdminNotes(
  customerId: string,
  preview: boolean,
): Promise<string> {
  if (preview) return getPreviewCustomerAdminNotes(customerId);

  const response = await fetch(`/api/admin/customers/${customerId}/notes`, {
    credentials: "include",
  });
  const body = (await response.json()) as { notes?: string; error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? "Could not load this customer record.");
  }
  return body.notes ?? "";
}

export async function saveCustomerAdminNotes(
  customerId: string,
  notes: string,
  preview: boolean,
): Promise<string> {
  if (preview) {
    setPreviewCustomerAdminNotes(customerId, notes);
    return notes;
  }

  const response = await fetch(`/api/admin/customers/${customerId}/notes`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
  const body = (await response.json()) as { notes?: string; error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? "Could not save this customer record.");
  }
  return body.notes ?? notes;
}
