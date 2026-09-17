import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  loadCustomerAdminNotes,
  saveCustomerAdminNotes,
} from "@/lib/profiles/admin-notes-client";

describe("preview customer admin notes cache", () => {
  it("reloads the same note for the same customer", async () => {
    const store = new Map<string, string>();
    const storage = {
      getItem(key: string) {
        return store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        store.set(key, value);
      },
      removeItem(key: string) {
        store.delete(key);
      },
      clear() {
        store.clear();
      },
      key() {
        return null;
      },
      get length() {
        return store.size;
      },
    } satisfies Storage;
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: storage,
    });

    await saveCustomerAdminNotes(
      "11111111-1111-4111-8111-111111111111",
      "Prefers side-door entry.",
      true,
    );

    assert.equal(
      await loadCustomerAdminNotes(
        "11111111-1111-4111-8111-111111111111",
        true,
      ),
      "Prefers side-door entry.",
    );
    assert.equal(
      await loadCustomerAdminNotes(
        "22222222-2222-4222-8222-222222222222",
        true,
      ),
      "",
    );
  });
});
