import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BOOKING_DRAFT_SESSION_KEY,
  clearBookingDraftSnapshot,
  readBookingDraftSnapshot,
  writeBookingDraftSnapshot,
  type BookingDraftSnapshot,
} from "@/lib/booking-draft";
import { createDraftBookingPet } from "@/lib/booking-flow";

describe("booking draft session persistence", () => {
  it("round-trips a draft snapshot through sessionStorage", () => {
    const store = new Map<string, string>();
    const original = globalThis.window;
    // @ts-expect-error test shim
    globalThis.window = {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    };

    const snapshot: BookingDraftSnapshot = {
      v: 1,
      draftPet: {
        ...createDraftBookingPet("draft-test"),
        name: "Audit Pup",
        breed: "Poodle",
        weightLbs: 18,
      },
      selectedPet: null,
      selectedService: null,
      serviceConfirmed: false,
      careOptionsConfirmed: false,
      selectedAddOnIds: [],
      addOnOptions: {},
      address: null,
      travelQuote: null,
      appointmentDate: null,
      appointmentTime: null,
      timePreference: null,
      slotStartMinutes: null,
      owner: null,
      paymentMethod: null,
    };

    writeBookingDraftSnapshot(snapshot);
    assert.equal(store.has(BOOKING_DRAFT_SESSION_KEY), true);
    const restored = readBookingDraftSnapshot();
    assert.equal(restored?.draftPet.name, "Audit Pup");
    assert.equal(restored?.draftPet.weightLbs, 18);

    clearBookingDraftSnapshot();
    assert.equal(readBookingDraftSnapshot(), null);

    globalThis.window = original;
  });
});
