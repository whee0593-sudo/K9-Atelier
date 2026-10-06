import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookForCustomerForm } from "@/components/admin/BookForCustomerForm";
import { BookForCustomerSections } from "@/components/admin/BookForCustomerSections";
import { bookingFormStartsOpen } from "@/lib/staff/booking-form-start";
import type { StaffCustomerRecord } from "@/lib/profiles/staff-service";

describe("BookForCustomerForm preview schedule", () => {
  it("opens a calendar picker instead of a free date field that can land on a closed day", () => {
    const html = renderToStaticMarkup(<BookForCustomerForm preview />);
    assert.match(html, /id="appointment-date"/);
    assert.match(html, /Select a date/);
    assert.match(html, /aria-haspopup="dialog"/);
    assert.doesNotMatch(html, /type="date"/);
    assert.doesNotMatch(html, /<select id="appointment-date"/);
    assert.match(html, /Select a date to see available start hours/);
  });

  it("uses the calendar date as the default appointment date", () => {
    const html = renderToStaticMarkup(
      <BookForCustomerForm preview initialDate="2026-10-12" />,
    );
    assert.match(html, /Mon, Oct 12/);
    assert.match(html, /value="2026-10-12"/);
  });

  it("keeps the date picker available before the service area is checked", () => {
    const html = renderToStaticMarkup(<BookForCustomerForm />);
    assert.match(html, /id="appointment-date"/);
    assert.match(html, /Select a date/);
    assert.match(html, /Studio dates are listed/);
    assert.doesNotMatch(html, /Could not load available dates/);
  });

  it("shows dog fields with an Add control under the first row", () => {
    const html = renderToStaticMarkup(<BookForCustomerForm preview />);
    assert.match(html, /Dog name/);
    assert.match(html, /Breed/);
    assert.match(html, /Weight \(lbs\)/);
    assert.match(html, />Add</);
  });

  it("explains that only email or phone is required", () => {
    const html = renderToStaticMarkup(<BookForCustomerForm preview />);
    assert.match(html, /Only an email or mobile phone is required/);
    assert.match(html, /Send booking link/);
    assert.doesNotMatch(html, /\srequired(=|>|\s)/);
  });

  it("fills saved pets and address from an existing customer file", () => {
    const html = renderToStaticMarkup(
      <BookForCustomerForm
        preview
        prefill={{
          customerId: "11111111-1111-4111-8111-111111111111",
          firstName: "Jose",
          lastName: "Perez",
          email: "jose@example.com",
          phone: "+15613520356",
        }}
        initialProfile={{
          customerId: "11111111-1111-4111-8111-111111111111",
          firstName: "Jose",
          lastName: "Perez",
          email: "jose@example.com",
          phone: "+15613520356",
          pets: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              name: "Luna",
              breed: "Poodle",
              weightLbs: 14.5,
            },
            {
              id: "33333333-3333-4333-8333-333333333333",
              name: "Max",
              breed: "Maltese",
              weightLbs: 11,
            },
          ],
          addresses: [
            {
              street: "10 Main St",
              city: "Palm Beach",
              state: "FL",
              zip: "33480",
            },
            {
              street: "20 Ocean Ave",
              city: "Palm Beach",
              state: "FL",
              zip: "33480",
            },
          ],
        }}
      />,
    );
    assert.match(html, /value="Luna"/);
    assert.match(html, /value="Poodle"/);
    assert.match(html, /value="14.5"/);
    assert.match(html, /value="Max"/);
    assert.match(html, /value="10 Main St"/);
    assert.match(html, /value="33480"/);
    assert.match(html, /Saved addresses/);
    assert.match(html, /20 Ocean Ave/);
    assert.match(html, /Saved pets and address are filled in from this customer/);
  });

  it("puts the service under the dog and can add a second service", () => {
    const html = renderToStaticMarkup(<BookForCustomerForm preview />);
    assert.doesNotMatch(html, /id="service-id"/);
    assert.match(html, /id="pet-service-/);
    assert.match(html, /w-1\/2/);
    assert.match(html, />Add service</);
    assert.doesNotMatch(html, /Remove service/);
    assert.equal((html.match(/id="pet-service-/g) ?? []).length, 1);
  });

  it("puts a service choice under each dog and limits it to that dog's weight", () => {
    const html = renderToStaticMarkup(
      <BookForCustomerForm
        preview
        initialProfile={{
          customerId: "11111111-1111-4111-8111-111111111111",
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.com",
          phone: "+15615550123",
          pets: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              name: "Luna",
              breed: "Poodle",
              weightLbs: 14.5,
            },
            {
              id: "33333333-3333-4333-8333-333333333333",
              name: "Bear",
              breed: "Airedale",
              weightLbs: 60,
            },
          ],
          addresses: [],
        }}
      />,
    );
    assert.doesNotMatch(html, /id="service-id"/);
    const lightStart = html.indexOf(
      'id="pet-service-22222222-2222-4222-8222-222222222222-0"',
    );
    const heavyStart = html.indexOf(
      'id="pet-service-33333333-3333-4333-8333-333333333333-0"',
    );
    assert.ok(lightStart >= 0);
    assert.ok(heavyStart > lightStart);
    const light = html.slice(lightStart, heavyStart);
    const heavy = html.slice(heavyStart, html.indexOf("</select>", heavyStart));
    assert.match(light, /Custom Full Haircut &amp; Styling/);
    assert.match(light, />SPA-Dead Sea Mud Bath Treatment</);
    assert.match(light, />SPA-Aromatherapy Essential Oil Bath Soak</);
    assert.match(light, />SPA-Sensitive Skin &amp; Dander Soothing Treatment</);
    assert.match(light, />Specialty care-Extra-gentle senior care</);
    assert.match(light, />Specialty care-End-of-Life Comfort Care</);
    assert.match(light, />Add-on care-Dematting@gentle brush-out</);
    assert.match(light, />Add-on care-DeShedding Treatment</);
    assert.match(light, />Add-on care-Mini Trim</);
    assert.doesNotMatch(light, />Dead Sea Mud Bath Treatment</);
    assert.match(light, />Creative coloring-Temporary Fun</);
    assert.match(light, />Creative coloring-Ears &amp; Tail Accent</);
    assert.match(light, />Creative coloring-Paws &amp; Boots Accent</);
    assert.match(light, />Creative coloring-Custom Creative Design</);
    assert.doesNotMatch(light, />Temporary Fun</);
    assert.doesNotMatch(light, />Creative Accent Coloring</);
    assert.match(heavy, /Hand Stripping/);
    assert.match(heavy, />Specialty care-End-of-Life Comfort Care</);
    assert.doesNotMatch(heavy, /Custom Full Haircut/);
    assert.doesNotMatch(heavy, /Temporary Fun/);
    assert.doesNotMatch(heavy, /SPA-/);
    assert.doesNotMatch(heavy, /Add-on care-/);
    assert.doesNotMatch(heavy, /Extra-gentle senior care/);
    assert.match(html, /Dog 1/);
    assert.match(html, /Dog 2/);
    assert.equal((html.match(/>Add service</g) ?? []).length, 2);
  });
});

const onFileCustomer: StaffCustomerRecord = {
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
  },
  pets: [],
  paymentMethods: [],
  kind: "customer",
  frozen: false,
  canDelete: false,
  canFreeze: false,
};

describe("Book for customer sections", () => {
  it("keeps both booking bars collapsed until they are opened", () => {
    const html = renderToStaticMarkup(
      <BookForCustomerSections
        showPreviewLink
        preview
        previewCustomers={[onFileCustomer]}
        prefill={{
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.com",
        }}
      />,
    );
    const onFile = html.indexOf("Book for customer on file");
    const fresh = html.indexOf("Book for a new customer");
    assert.ok(onFile >= 0);
    assert.ok(fresh > onFile);
    assert.equal(html.match(/aria-expanded="false"/g)?.length, 2);
    assert.doesNotMatch(html, /Only an email or mobile phone is required/);
    assert.doesNotMatch(html, /Open preview/);
    assert.doesNotMatch(html, /Ada Lovelace/);
  });

  it("opens the existing form when staff arrive from a customer or calendar link", () => {
    assert.equal(bookingFormStartsOpen({}), false);
    assert.equal(bookingFormStartsOpen({ date: "tomorrow" }), false);
    assert.equal(bookingFormStartsOpen({ customerId: onFileCustomer.profile.id }), true);
    assert.equal(bookingFormStartsOpen({ date: "2026-10-12" }), true);

    const html = renderToStaticMarkup(
      <BookForCustomerSections
        showPreviewLink
        preview
        formInitiallyOpen
        previewCustomers={[onFileCustomer]}
        initialDate="2026-10-12"
      />,
    );
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, /aria-expanded="true"/);
    assert.match(html, /Only an email or mobile phone is required/);
    assert.match(html, /Open preview/);
    assert.match(html, /Mon, Oct 12/);
    assert.doesNotMatch(html, /Ada Lovelace/);
  });
});
