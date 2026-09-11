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
    canDelete: true,
    ...rest,
  };
}

describe("CustomerRecordCard actions", () => {
  it("shows Delete for regular customers", () => {
    const html = renderToStaticMarkup(
      <CustomerRecordCard
        customer={sampleCustomer()}
        onProfileSaved={() => undefined}
        onPetSaved={() => undefined}
        onDeleted={() => undefined}
      />,
    );
    assert.match(html, />Delete</);
    assert.match(html, /Ada Lovelace/);
  });

  it("hides Delete for protected staff accounts", () => {
    const html = renderToStaticMarkup(
      <CustomerRecordCard
        customer={sampleCustomer({
          canDelete: false,
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
        onProfileSaved={() => undefined}
        onPetSaved={() => undefined}
        onDeleted={() => undefined}
      />,
    );
    assert.doesNotMatch(html, />Delete</);
    assert.match(html, /penny@k9atelier.com/);
  });
});
