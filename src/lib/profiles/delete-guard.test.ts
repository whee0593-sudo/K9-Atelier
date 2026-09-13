import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  customerDeleteBlockReason,
  customerDeleteConfirmMessage,
  customerFreezeConfirmMessage,
  isAdminAccountEmail,
  ownerAccountActionBlockReason,
} from "@/lib/profiles/delete-guard";

const actor = "11111111-1111-4111-8111-111111111111";
const target = "22222222-2222-4222-8222-222222222222";

describe("ownerAccountActionBlockReason", () => {
  it("blocks non-owners from deleting or freezing", () => {
    assert.equal(
      ownerAccountActionBlockReason({
        action: "delete",
        actorIsOwner: false,
        actorUserId: actor,
        targetUserId: target,
        targetEmail: "ada@example.com",
      }),
      "Only the owner can delete accounts.",
    );
    assert.equal(
      ownerAccountActionBlockReason({
        action: "freeze",
        actorIsOwner: false,
        actorUserId: actor,
        targetUserId: target,
        targetEmail: "helper@k9atelier.com",
      }),
      "Only the owner can freeze accounts.",
    );
  });

  it("blocks the owner from acting on their own account", () => {
    assert.equal(
      customerDeleteBlockReason({
        actorIsOwner: true,
        actorUserId: actor,
        targetUserId: actor,
        targetEmail: "penny@k9atelier.com",
      }),
      "You cannot delete the account you are signed in with.",
    );
    assert.equal(
      ownerAccountActionBlockReason({
        action: "freeze",
        actorIsOwner: true,
        actorUserId: actor,
        targetUserId: actor,
        targetEmail: "penny@k9atelier.com",
      }),
      "You cannot freeze the account you are signed in with.",
    );
  });

  it("blocks deleting or freezing the owner account from another login", () => {
    assert.equal(
      customerDeleteBlockReason({
        actorIsOwner: true,
        actorUserId: actor,
        targetUserId: target,
        targetEmail: "Penny@k9atelier.com",
      }),
      "The owner account cannot be deleted.",
    );
  });

  it("lets the owner delete or freeze an admin or customer", () => {
    assert.equal(
      customerDeleteBlockReason({
        actorIsOwner: true,
        actorUserId: actor,
        targetUserId: target,
        targetEmail: "helper@k9atelier.com",
      }),
      null,
    );
    assert.equal(
      ownerAccountActionBlockReason({
        action: "freeze",
        actorIsOwner: true,
        actorUserId: actor,
        targetUserId: target,
        targetEmail: "ada@example.com",
      }),
      null,
    );
  });
});

describe("isAdminAccountEmail", () => {
  it("treats the owner and listed staff emails as admins", () => {
    assert.equal(isAdminAccountEmail("penny@k9atelier.com", []), true);
    assert.equal(
      isAdminAccountEmail("Helper@k9atelier.com", ["helper@k9atelier.com"]),
      true,
    );
    assert.equal(
      isAdminAccountEmail("ada@example.com", ["helper@k9atelier.com"]),
      false,
    );
  });
});

describe("confirm copy", () => {
  it("names the customer for delete and freeze", () => {
    assert.match(customerDeleteConfirmMessage("Ada Lovelace"), /Ada Lovelace/);
    assert.match(customerFreezeConfirmMessage("Ada Lovelace", false), /Freeze/);
    assert.match(customerFreezeConfirmMessage("Ada Lovelace", true), /Unfreeze/);
  });
});
