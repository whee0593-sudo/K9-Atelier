import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomerAdminNotesEditor } from "@/components/admin/CustomerAdminNotesEditor";
import { CustomerRecordCard } from "@/components/admin/CustomerRecordsPanel";
import { StaffCustomerPassword } from "@/components/admin/StaffCustomerPassword";
import { StaffCustomerReferrals } from "@/components/admin/StaffCustomerReferrals";
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

const cardHandlers = {
  onProfileSaved: noop,
  onPetSaved: noop,
  onPetCreated: noop,
  onPetArchived: noop,
  onPaymentMethodsChange: noop,
  onDeleted: noop,
  onFrozenChange: noop,
};

describe("CustomerRecordCard actions", () => {
  it("shows Freeze and Delete for accounts the owner can manage", () => {
    const html = renderToStaticMarkup(
      <CustomerRecordCard customer={sampleCustomer()} {...cardHandlers} />,
    );
    assert.match(html, />Delete</);
    assert.match(html, />Freeze</);
    assert.match(html, /Book for customer/);
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
        {...cardHandlers}
      />,
    );
    assert.doesNotMatch(html, />Delete</);
    assert.doesNotMatch(html, />Freeze</);
    assert.match(html, /Owner/);
  });

  it("shows Unfreeze when the account is already frozen", () => {
    const html = renderToStaticMarkup(
      <CustomerRecordCard customer={sampleCustomer({ frozen: true })} {...cardHandlers} />,
    );
    assert.match(html, />Unfreeze</);
    assert.match(html, /Frozen/);
    assert.doesNotMatch(html, /Book for customer/);
  });

  it("shows the admin-only customer record notes editor", () => {
    const html = renderToStaticMarkup(
      <CustomerAdminNotesEditor customerId="11111111-1111-4111-8111-111111111111" />,
    );
    assert.match(html, />Customer record</);
    assert.match(html, /Admin only\. These notes stay with this customer\./);
    assert.match(html, /<textarea/);
    assert.match(html, />Save</);
  });

  it("opens the same customer-record notes on a customer file", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/admin/CustomerRecordsPanel.tsx"),
      "utf8",
    );
    assert.match(source, /CustomerAdminNotesEditor/);
  });

  it("lets staff save the owner profile on a customer file", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/admin/CustomerRecordsPanel.tsx"),
      "utf8",
    );
    assert.match(source, /audience="staff"/);
    assert.match(source, /preview=\{preview\}/);
    assert.match(source, /StaffCustomerPets/);
    assert.match(source, /StaffCustomerPayments/);
    assert.match(source, /StaffCustomerPassword/);
    assert.match(source, /StaffCustomerReferrals/);
    assert.match(source, /Service addresses/);
  });

  it("lets staff view and edit every guest account section", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/admin/CustomerRecordsPanel.tsx"),
      "utf8",
    );
    assert.match(source, /StaffCustomerPets/);
    assert.match(source, /StaffCustomerPayments/);
    assert.match(source, /StaffCustomerPassword/);
    assert.match(source, /StaffCustomerReferrals/);
    assert.match(source, /Service addresses/);

    const petsSource = readFileSync(
      path.join(process.cwd(), "src/components/admin/StaffCustomerPets.tsx"),
      "utf8",
    );
    assert.match(petsSource, /\+ Add a pet/);
    assert.match(petsSource, /Remove this pet profile/);
    assert.match(petsSource, /onVaccinationUpload/);

    const paymentsSource = readFileSync(
      path.join(process.cwd(), "src/components/admin/StaffCustomerPayments.tsx"),
      "utf8",
    );
    assert.match(paymentsSource, /\+ Add a card/);
    assert.match(paymentsSource, /deleteStaffCustomerPaymentMethod/);

    const password = renderToStaticMarkup(
      <StaffCustomerPassword
        customerId="11111111-1111-4111-8111-111111111111"
        preview
      />,
    );
    assert.match(password, /Password/);
    assert.match(password, /Save password/);

    const referrals = renderToStaticMarkup(
      <StaffCustomerReferrals
        customerId="11111111-1111-4111-8111-111111111111"
        preview
        previewView={{
          availableCreditCents: 1800,
          availableLabel: "18.00",
          codes: [{ petName: "Milo", code: "MILO-TIA" }],
          rewards: [],
        }}
      />,
    );
    assert.match(referrals, /Referrals/);
    assert.match(referrals, /MILO-TIA/);
  });
});
