import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildStaffInboundForwardSms,
  inboundMediaUrls,
  inboundReplyTextForStaff,
} from "./inbox-copy";
import { formatPetAndOwnerLabel } from "./inbox-copy";

describe("staff SMS inbox copy", () => {
  it("labels replies with pet and first name", () => {
    assert.equal(
      formatPetAndOwnerLabel({ firstName: "Jane", petNames: ["Bella"] }),
      "Bella · Jane",
    );
    assert.equal(
      buildStaffInboundForwardSms({
        ownerName: "Jane Doe",
        petNames: ["Bella"],
        body: "Can we move to 2pm?",
        phone: "+15615550131",
      }),
      "K9 ATELIER reply from Bella Jane Doe +15615550131:\n\nCan we move to 2pm?",
    );
  });

  it("forwards photo-only replies with a photo label", () => {
    assert.deepEqual(
      inboundMediaUrls({
        MediaUrl0: "https://api.twilio.com/media/ME1",
      }),
      ["https://api.twilio.com/media/ME1"],
    );
    assert.equal(inboundReplyTextForStaff({ body: "", mediaCount: 1 }), "Photo");
    assert.equal(
      buildStaffInboundForwardSms({
        ownerName: "Jane Doe",
        petNames: ["Bella"],
        body: "",
        phone: "+15615550131",
        mediaCount: 1,
      }),
      "K9 ATELIER reply from Bella Jane Doe +15615550131:\n\nPhoto",
    );
  });

  it("keeps inbound photo URLs on the staff inbox list", () => {
    const inbox = readFileSync(new URL("./inbox.ts", import.meta.url), "utf8");
    assert.match(inbox, /media_urls/);
    assert.match(inbox, /mediaUrls/);
    const inbound = readFileSync(new URL("./inbound.ts", import.meta.url), "utf8");
    assert.match(inbound, /mediaUrls,/);
    const composer = readFileSync(
      new URL("../../components/admin/AdminMessageComposer.tsx", import.meta.url),
      "utf8",
    );
    assert.match(composer, /Customer photo/);
    assert.match(composer, /staffSmsMediaProxyPath/);
  });
});
