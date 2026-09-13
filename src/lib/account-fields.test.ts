import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accountConfig, getAccountSection } from "@/lib/account-fields";

describe("account sections", () => {
  it("does not expose an in-site messages inbox", () => {
    assert.equal(getAccountSection("messages"), undefined);
    assert.equal(
      accountConfig.sections.some((section) => section.id === "messages"),
      false,
    );
    assert.equal(
      accountConfig.sections.some((section) =>
        section.path.includes("/messages"),
      ),
      false,
    );
  });
});
