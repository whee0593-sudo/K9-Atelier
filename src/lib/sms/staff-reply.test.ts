import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildStaffReplyFailedSms,
  buildStaffReplySentSms,
  splitStaffReply,
} from "./staff-reply-copy";

describe("staff phone reply", () => {
  it("sends the whole text to the last customer by default", () => {
    assert.deepEqual(splitStaffReply("Bella is ready at 2."), {
      phone: null,
      message: "Bella is ready at 2.",
    });
  });

  it("lets staff start a reply with a customer number", () => {
    assert.deepEqual(splitStaffReply("+15615550131 See you at 2."), {
      phone: "+15615550131",
      message: "See you at 2.",
    });
    assert.deepEqual(splitStaffReply("5615550131: Running late"), {
      phone: "+15615550131",
      message: "Running late",
    });
  });

  it("confirms the send in English", () => {
    assert.equal(
      buildStaffReplySentSms("Bella Jane Doe +15615550131"),
      "K9 ATELIER: Sent to Bella Jane Doe +15615550131.",
    );
    assert.match(buildStaffReplyFailedSms(), /No recent customer/);
  });
});
