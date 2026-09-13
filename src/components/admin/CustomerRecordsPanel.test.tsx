import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomerRecordCard } from "@/components/admin/CustomerRecordsPanel";
import type { StaffCustomerRecord } from "@/lib/profiles/staff-service";

function sampleCustomer(
  overrides: Partial<Omit<StaffCustomerRecord, "profile">> & {
    profile?: Partial<StaffCustomerRecord["profile"]>;
  } = {},
): StaffCustomerRecord {
  const { profile, ...rest } = overrides;
  return {
    profile: {
      id: "11111111-1111-4111-8111-111111111111",
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      phone: "+15615550123",
      preferredContact: "Text Message",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelationship: "",
      ...profile,
    },
    pets: [],
    paymentMethods: [],
    kind: "customer",
    frozen: false,
    canDelete: true,
    canFreeze: true,
    ...rest,
  };
}

const noop = () => undefined;

describe("CustomerRecordCard actions", () => {
  it("shows Freeze and Delete for accounts the owner can manage", () => {
    const html = renderToStaticMarkup(
      <CustomerRecordCard
        customer={sampleCustomer()}
        onProfileSaved={noop}
        onPetSaved={noop}
        onDeleted={noop}
        onFrozenChange={noop}
      />,
    );
    assert.match(html, />Delete</);
    assert.match(html, />Freeze</);
    assert.match(html, /Ada Lovelace/);
  });

  it("hides access actions on the owner account", () => {
    const html = renderToStaticMarkup(
      <CustomerRecordCard
        customer={sampleCustomer({
          kind: "admin",
          canDelete: false,
          canFreeze: false,
          profile: {
            id: "22222222-2222-4222-8222-222222222222",
            email: "penny@k9atelier.com",
            firstName: "Penny",
            lastName: "K9 Atelier",
            phone: "+15615933335",
            preferredContact: "Email",
            emergencyContactName: "",
            emergencyContactPhone: "",
            emergencyContactRelationship: "",
          },
        })}
        onProfileSaved={noop}
        onPetSaved={noop}
        onDeleted={noop}
        onFrozenChange={noop}
      />,
    );
    assert.doesNotMatch(html, />Delete</);
    assert.doesNotMatch(html, />Freeze</);
    assert.match(html, /Owner/);
  });

  it("shows Unfreeze when the account is already frozen", () => {
    const html = renderToStaticMarkup(
      <CustomerRecordCard
        customer={sampleCustomer({ frozen: true })}
        onProfileSaved={noop}
        onPetSaved={noop}
        onDeleted={noop}
        onFrozenChange={noop}
      />,
    );
    assert.match(html, />Unfreeze</);
    assert.match(html, /Frozen/);
  });
});
