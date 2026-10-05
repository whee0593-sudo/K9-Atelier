import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomerAdminNotesEditor } from "@/components/admin/CustomerAdminNotesEditor";
import {
  CustomerRecordCard,
  CustomerRecordsPanel,
} from "@/components/admin/CustomerRecordsPanel";
import {
  latestPetServiceLabel,
  recordExpirationSummaryValue,
  StaffCustomerPets,
} from "@/components/admin/StaffCustomerPets";
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
    assert.match(
      html,
      /\/admin\/book-for-customer\?customerId=11111111-1111-4111-8111-111111111111/,
    );
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
    assert.match(source, /ServiceAddressAddForm/);
    assert.match(source, /\bEdit\b/);
    assert.match(source, /\+ Add address/);
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

  it("shows Edit and Add address controls on service addresses", () => {
    const html = renderToStaticMarkup(
      <CustomerRecordCard
        customer={sampleCustomer({
          profile: {
            id: "44444444-4444-4444-8444-444444444444",
            email: "tiafrancavilla@gmail.com",
            firstName: "Tia",
            lastName: "Francavilla",
            phone: "+15613466778",
            preferredContact: "Text Message",
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
    assert.match(html, /\+ Add address/);
  });

  it("shows saved pets as name, age, last service, and Edit", () => {
    const petId = "55555555-5555-4555-8555-555555555555";
    const html = renderToStaticMarkup(
      <CustomerRecordCard
        customer={sampleCustomer({
          pets: [
            {
              id: petId,
              name: "Gigi",
              breed: "Yorkshire Terrier",
              weightLbs: 5,
              dateOfBirth: null,
              approximateAgeYears: 12,
              sex: "Female",
              temperamentNotes: "Nervous with dryers",
              healthComfortNotes: null,
              groomingPreferences: null,
              createdAt: "2026-09-01T12:00:00.000Z",
              updatedAt: "2026-09-01T12:00:00.000Z",
              adminServiceNotes: "Senior dog",
              vaccinationBookingStatus: "current",
              vaccinationHasUpload: false,
            },
          ],
        })}
        startOpen
        preview
        previewHistory={{
          appointments: [
            {
              id: "77777777-7777-4777-8777-777777777777",
              customerId: "11111111-1111-4111-8111-111111111111",
              petId,
              petName: "Gigi",
              petBreed: "Yorkshire Terrier",
              serviceId: "signature-bath-care",
              serviceName: "Signature Bath & Care",
              addOnIds: [],
              addOnOptions: {},
              addressStreet: "2100 S Ocean Blvd",
              addressCity: "Palm Beach",
              addressState: "FL",
              addressZip: "33480",
              travelDistanceMiles: 4,
              travelFee: 0,
              appointmentDate: "2020-06-01",
              appointmentTime: "10–11 AM",
              scheduledStart: 600,
              timePreference: "morning",
              timezone: "America/New_York",
              estimatedTotal: 90,
              newClientDeposit: null,
              vaccinationStatusAtBooking: "current",
              status: "confirmed",
              confirmedAt: "2020-05-20T14:00:00.000Z",
              customerConfirmedAt: null,
              createdAt: "2020-05-20T14:00:00.000Z",
              customerEmail: "ada@example.com",
              customerName: null,
              customerFirstName: "Ada",
              customerLastName: "Lovelace",
              customerPhone: "+15615550123",
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

    assert.match(html, /Gigi/);
    assert.match(html, /12 years/);
    assert.match(html, /Last service Jun 1, 2020 · 10–11 AM/);
    assert.match(html, /Open Gigi profile/);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, />Edit</);
    assert.doesNotMatch(html, /Pet Name/);
    assert.doesNotMatch(html, /Nervous with dryers/);
    assert.doesNotMatch(html, /Save Pet/);
    assert.match(html, /\+ Add a pet/);
  });

  it("puts Edit on the customer row and shows saved profile fields when opened", () => {
    const collapsed = renderToStaticMarkup(
      <CustomerRecordCard customer={sampleCustomer()} preview {...cardHandlers} />,
    );
    assert.match(
      collapsed,
      /Book for customer<\/a><button[^>]*>Edit<\/button><button[^>]*>Freeze<\/button>/,
    );
    assert.doesNotMatch(collapsed, /Emergency Contact Name/);
    assert.doesNotMatch(collapsed, /Save Profile/);

    const opened = renderToStaticMarkup(
      <CustomerRecordCard
        customer={sampleCustomer()}
        startOpen
        preview
        {...cardHandlers}
      />,
    );
    assert.match(opened, /Owner Profile/);
    assert.match(opened, /Emergency Contact Name/);
    assert.match(opened, /ada@example.com/);
    assert.match(opened, /\+15615550123/);
    assert.match(opened, /Text Message/);
    assert.doesNotMatch(opened, /Save Profile/);
    assert.doesNotMatch(opened, /Open Ada Lovelace profile/);
    const profileStart = opened.indexOf("Owner Profile");
    const profileEnd = opened.indexOf("Payment Methods");
    const profileHtml = opened.slice(profileStart, profileEnd);
    assert.doesNotMatch(profileHtml, />Edit</);
  });
});

describe("latestPetServiceLabel", () => {
  const petId = "55555555-5555-4555-8555-555555555555";
  const now = new Date("2026-10-05T16:00:00.000Z");

  it("uses the latest past visit and skips cancelled or future bookings", () => {
    const label = latestPetServiceLabel(
      [
        {
          petId,
          status: "cancelled",
          appointmentDate: "2026-10-01",
          appointmentTime: "2–3 PM",
          scheduledStart: 840,
        },
        {
          petId,
          status: "confirmed",
          appointmentDate: "2026-09-22",
          appointmentTime: "10–11 AM",
          scheduledStart: 600,
        },
        {
          petId,
          status: "confirmed",
          appointmentDate: "2026-11-02",
          appointmentTime: "9–10 AM",
          scheduledStart: 540,
        },
        {
          petId,
          status: "confirmed",
          appointmentDate: "2026-09-22",
          appointmentTime: "1–2 PM",
          scheduledStart: 780,
        },
      ],
      petId,
      now,
    );
    assert.equal(label, "Last service Sep 22, 2026 · 1–2 PM");
  });

  it("says there is no service when every visit is still ahead", () => {
    assert.equal(
      latestPetServiceLabel(
        [
          {
            petId,
            status: "confirmed",
            appointmentDate: "2026-12-01",
            appointmentTime: "9–10 AM",
            scheduledStart: 540,
          },
        ],
        petId,
        now,
      ),
      "No service yet",
    );
  });

  it("renders a collapsed row without opening the editor", () => {
    const html = renderToStaticMarkup(
      <StaffCustomerPets
        customerId="11111111-1111-4111-8111-111111111111"
        preview
        appointments={[]}
        pets={[
          {
            id: petId,
            name: "Gigi",
            breed: "Yorkshire Terrier",
            weightLbs: 5,
            dateOfBirth: null,
            approximateAgeYears: 12,
            sex: null,
            temperamentNotes: null,
            healthComfortNotes: null,
            groomingPreferences: null,
            createdAt: "2026-09-01T12:00:00.000Z",
            updatedAt: "2026-09-01T12:00:00.000Z",
            adminServiceNotes: "",
            vaccinationBookingStatus: "missing",
            vaccinationHasUpload: false,
          },
        ]}
        onPetSaved={noop}
        onPetCreated={noop}
        onPetArchived={noop}
      />,
    );
    assert.match(html, /No service yet/);
    assert.match(html, />Edit</);
    assert.doesNotMatch(html, /<textarea/);
  });

  it("shows a saved record expiration date on the pet profile", () => {
    assert.equal(
      recordExpirationSummaryValue({ rabiesExpirationDate: "2027-06-15" }),
      "Jun 15, 2027",
    );
    assert.equal(
      recordExpirationSummaryValue({ vaccinationExpirationDate: "2026-11-01" }),
      "Nov 1, 2026",
    );
    assert.equal(recordExpirationSummaryValue({}), "—");
  });
});

describe("Create customer profile section", () => {
  it("sits between administrators and customers", () => {
    const html = renderToStaticMarkup(
      <CustomerRecordsPanel
        preview
        previewCustomers={[
          sampleCustomer({
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
          }),
          sampleCustomer(),
        ]}
      />,
    );
    const administrators = html.indexOf(">Administrators<");
    const create = html.indexOf(">Create customer profile<");
    const ada = html.indexOf("Ada Lovelace");
    assert.ok(administrators >= 0);
    assert.ok(create > administrators);
    assert.ok(ada > create);
    assert.match(html, />Add\+</);
    assert.doesNotMatch(html, />Customers</);
    assert.doesNotMatch(html, /Every field is optional/);
    assert.doesNotMatch(html, />Create profile</);
    const between = html.slice(create, ada);
    assert.doesNotMatch(between, /<form/);
    assert.doesNotMatch(between, /Owner Profile/);
    assert.match(html, /penny@k9atelier.com/);
    assert.ok(html.indexOf("penny@k9atelier.com") < create);
  });

  it("creates a customer file from the staff customers route", () => {
    const panel = readFileSync(
      path.join(process.cwd(), "src/components/admin/CustomerRecordsPanel.tsx"),
      "utf8",
    );
    const route = readFileSync(
      path.join(process.cwd(), "src/app/api/admin/customers/route.ts"),
      "utf8",
    );
    const service = readFileSync(
      path.join(process.cwd(), "src/lib/profiles/staff-service.ts"),
      "utf8",
    );
    assert.match(panel, /<CreateCustomerProfileForm/);
    assert.match(panel, /Add\+/);
    assert.match(panel, /addCreateDraft/);
    assert.match(panel, /createDrafts\.map/);
    assert.doesNotMatch(panel, /Every field is optional/);
    assert.match(route, /export async function POST/);
    assert.match(route, /createStaffCustomer/);
    assert.match(service, /export async function createStaffCustomer/);
  });
});
