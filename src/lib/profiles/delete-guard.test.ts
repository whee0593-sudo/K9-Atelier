import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  customerDeleteBlockReason,
  customerDeleteConfirmMessage,
  isProtectedStaffEmail,
} from "@/lib/profiles/delete-guard";

const actor = "11111111-1111-4111-8111-111111111111";
const target = "22222222-2222-4222-8222-222222222222";

describe("customerDeleteBlockReason", () => {
  it("blocks deleting the signed-in account", () => {
    assert.equal(
      customerDeleteBlockReason({
        actorUserId: actor,
        targetUserId: actor,
        targetEmail: "ada@example.com",
        targetIsStaff: false,
      }),
      "You cannot delete the account you are signed in with.",
    );
  });

  it("blocks deleting the owner even if not marked staff", () => {
    assert.equal(
      customerDeleteBlockReason({
        actorUserId: actor,
        targetUserId: target,
        targetEmail: "Penny@k9atelier.com",
        targetIsStaff: false,
      }),
      "The owner account cannot be deleted.",
    );
  });

  it("blocks deleting other admin accounts", () => {
    assert.equal(
      customerDeleteBlockReason({
        actorUserId: actor,
        targetUserId: target,
        targetEmail: "helper@k9atelier.com",
        targetIsStaff: true,
      }),
      "Admin accounts cannot be deleted here. Use Admin Team to remove staff access.",
    );
  });

  it("allows deleting a regular customer", () => {
    assert.equal(
      customerDeleteBlockReason({
        actorUserId: actor,
        targetUserId: target,
        targetEmail: "ada@example.com",
        targetIsStaff: false,
      }),
      null,
    );
  });
});

describe("isProtectedStaffEmail", () => {
  it("protects the owner and listed staff emails", () => {
    assert.equal(isProtectedStaffEmail("penny@k9atelier.com", []), true);
    assert.equal(
      isProtectedStaffEmail("Helper@k9atelier.com", ["helper@k9atelier.com"]),
      true,
    );
    assert.equal(
      isProtectedStaffEmail("ada@example.com", ["helper@k9atelier.com"]),
      false,
    );
  });
});

describe("customerDeleteConfirmMessage", () => {
  it("names the customer and lists what is removed", () => {
    const message = customerDeleteConfirmMessage("Ada Lovelace");
    assert.match(message, /Ada Lovelace/);
    assert.match(message, /login/);
    assert.match(message, /cannot be undone/);
  });
});
