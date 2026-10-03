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
    assert.match(source, /ServiceAddressEditor/);
    assert.match(source, /\bEdit\b/);
    assert.match(source, /Save Address/);
    assert.match(source, /\/api\/admin\/customers\/\$\{customerId\}\/addresses/);

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

  it("shows an Edit control on each service address in a customer file", () => {
    const html = renderToStaticMarkup(
      <CustomerRecordCard
        customer={sampleCustomer({
          profile: {
            id: "44444444-4444-4444-8444-444444444444",
            email: "tiafrancavilla@gmail.com",
            firstName: "",
            lastName: "",
            phone: "+15613466778",
            preferredContact: "",
            emergencyContactName: "",
            emergencyContactPhone: "",
            emergencyContactRelationship: "",
          },
        })}
        startOpen
        preview
        previewHistory={{
          appointments: [
            {
              id: "77777777-7777-4777-8777-777777777777",
              customerId: "44444444-4444-4444-8444-444444444444",
              petId: "55555555-5555-4555-8555-555555555555",
              petName: "Milo",
              petBreed: "Yorkie",
              serviceId: "signature-bath-care",
              serviceName: "Signature Bath & Care",
              addOnIds: [],
              addOnOptions: {},
              addressStreet: "2100 S Ocean Blvd",
              addressCity: "Palm Beach",
              addressState: "FL",
              addressZip: "33480",
              travelDistanceMiles: 12,
              travelFee: 13,
              appointmentDate: "2026-09-22",
              appointmentTime: "10–11 AM",
              scheduledStart: 600,
              timePreference: "morning",
              timezone: "America/New_York",
              estimatedTotal: 140,
              newClientDeposit: null,
              vaccinationStatusAtBooking: "needs_review",
              status: "confirmed",
              confirmedAt: "2026-09-18T14:00:00.000Z",
              customerConfirmedAt: null,
              createdAt: "2026-09-18T14:00:00.000Z",
              customerEmail: "tiafrancavilla@gmail.com",
              customerName: null,
              customerFirstName: "",
              customerLastName: "",
              customerPhone: "+15613466778",
              reminderSmsSentAt: null,
              enRouteSmsSentAt: null,
              serviceStartedAt: null,
              serviceEndedAt: null,
            },
          ],
          orders: [],
        }}
        {...cardHandlers}
      />,
    );
    assert.match(html, /Service addresses/);
    assert.match(html, /2100 S Ocean Blvd/);
    assert.match(html, />Edit</);
  });
});
