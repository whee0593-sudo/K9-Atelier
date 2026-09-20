import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatServiceAddress, streetWithAccessNotes } from "@/lib/travel";

describe("service address helpers", () => {
  it("keeps the public address line free of parking notes", () => {
    assert.equal(
      formatServiceAddress({
        street: "123 Palm Avenue",
        city: "Orlando",
        state: "FL",
        zip: "32801",
        parkingNotes: "Gate code 1234",
      }),
      "123 Palm Avenue, Orlando, FL 32801",
    );
  });

  it("appends access notes when saving the appointment street", () => {
    assert.equal(
      streetWithAccessNotes({
        street: "123 Palm Avenue",
        city: "Orlando",
        state: "FL",
        zip: "32801",
        parkingNotes: "  Gate code 1234  ",
      }),
      "123 Palm Avenue (Access: Gate code 1234)",
    );
    assert.equal(
      streetWithAccessNotes({
        street: "123 Palm Avenue",
        city: "Orlando",
        state: "FL",
        zip: "32801",
      }),
      "123 Palm Avenue",
    );
  });
});
