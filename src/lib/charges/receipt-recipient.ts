import { validateEmailAddress } from "@/lib/profiles/validation";

export function receiptEmailAddress(value: unknown): string | null {
  try { return validateEmailAddress(value); } catch { return null; }
}

export type ReceiptEmailState = { email: string; draft: string; editing: boolean; error: string | null };
export function initialReceiptEmailState(value?: string | null): ReceiptEmailState {
  const email = value?.trim() ?? "";
  return { email, draft: email, editing: false, error: null };
}
export function receiptEmailReducer(state: ReceiptEmailState, action:
  { type: "edit" | "save" | "cancel" } | { type: "change"; value: string }): ReceiptEmailState {
  if (action.type === "edit") return { ...state, draft: state.email, editing: true, error: null };
  if (action.type === "cancel") return { ...state, draft: state.email, editing: false, error: null };
  if (action.type === "change") return { ...state, draft: action.value, error: null };
  const email = receiptEmailAddress(state.draft);
  return email ? { email, draft: email, editing: false, error: null }
    : { ...state, error: "Please enter a valid email address." };
}
