import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACCOUNT_HUB_MORE_IDS,
  ACCOUNT_HUB_PRIMARY_IDS,
  accountConfig,
  accountHubListsEverySection,
  accountHubSections,
} from "@/lib/account-fields";

describe("account hub grouping", () => {
  it("keeps every account section reachable from the hub", () => {
    assert.equal(accountHubListsEverySection(), true);
  });

  it("puts bookings, pets, payment, and profile on the first screen", () => {
    assert.deepEqual(
      accountHubSections("primary").map((section) => section.id),
      [...ACCOUNT_HUB_PRIMARY_IDS],
    );
    assert.deepEqual(
      accountHubSections("more").map((section) => section.id),
      [...ACCOUNT_HUB_MORE_IDS],
    );
  });

  it("does not drop a configured section from either group", () => {
    const hubIds = new Set([
      ...accountHubSections("primary").map((section) => section.id),
      ...accountHubSections("more").map((section) => section.id),
    ]);
    for (const section of accountConfig.sections) {
      assert.equal(hubIds.has(section.id), true, section.id);
    }
  });
});
