import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildStaffInboundForwardSms } from "./inbox-copy";
import { formatPetAndOwnerLabel } from "./inbox-copy";

describe("staff SMS inbox copy", () => {
  it("labels replies with pet and first name", () => {
    assert.equal(
      formatPetAndOwnerLabel({ firstName: "Jane", petNames: ["Bella"] }),
      "Bella · Jane",
    );
    assert.equal(
      buildStaffInboundForwardSms({
        firstName: "Jane",
        petNames: ["Bella"],
        body: "Can we move to 2pm?",
        phone: "+15615550131",
      }),
      "K9 ATELIER reply from Bella · Jane +15615550131:\n\nCan we move to 2pm?",
    );
  });
});
