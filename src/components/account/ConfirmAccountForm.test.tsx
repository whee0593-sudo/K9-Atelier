import React from "react";
import assert from "node:assert/strict";
import { it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { usableConfirmationCards, preferredPaymentMethodId } from "@/lib/staff/customer-confirm-status";
import { ConfirmAccountForm, AppointmentConfirmationSuccess } from "./ConfirmAccountForm";
import ConfirmAccountPage from "@/app/confirm-account/page";
import { buildPreviewCollectContext } from "@/lib/charges/preview";

Object.assign(globalThis, { React });
const appointment = buildPreviewCollectContext().appointment;
const base = { appointment, customer: {email:"owner@example.com",firstName:"Owner"}, requiresPassword:false };
const card = { id:"card",brand:"visa",last4:"1234",expMonth:12,expYear:2028,isDefault:true };
it("lists every dog in reservation order after the shared date and address", () => {
  const appointments = ["Stella","Valentino","Daisy","Milo"].map((petName,i) => ({...appointment,id:String(i),petName,serviceName:i===3?"Signature Bath":"The Atelier Full Groom"}));
  const html = renderToStaticMarkup(<ConfirmAccountForm token="preview" preview={{...base,appointment:appointments[0],appointments,paymentMethods:[card]}} />);
  let previous = html.indexOf(appointment.addressStreet);
  for (const pet of appointments) {
    const index = html.indexOf(`${pet.petName} - ${pet.serviceName}`);
    assert.ok(index > previous); previous=index;
  }
  assert.doesNotMatch(html, /Estimated total|Account:|I will not be charged now/);
});
it("shows stored card information and the no-charge message without asking to add another card", () => {
  const html = renderToStaticMarkup(<ConfirmAccountForm token="preview" preview={{...base,paymentMethods:[card]}} />);
  assert.match(html, /Visa •••• 1234/);
  assert.match(html, /Default/);
  assert.match(html, /You will not be charged now\./);
  assert.doesNotMatch(html, /Add a card|Use a different card|Exp 12/);
  assert.match(html, />Confirm<\/button>/);
});
it("lets a customer without a saved card add one before confirming", () => {
  const html = renderToStaticMarkup(<ConfirmAccountForm token="preview" preview={base} />);
  assert.match(html.replace(/<[^>]+>/g, ""), /Add a card to secure this appointment\./);
  assert.match(html, /You will not be charged now\./);
  assert.match(html, /<a[^>]*href="\/account\/setup"[^>]*>Add a card<\/a>/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Confirm<\/button>/);
  assert.doesNotMatch(html, /Use a different card/);
});
it("retains required password setup for a newly created unclaimed account", () => {
  const html = renderToStaticMarkup(<ConfirmAccountForm token="preview" preview={{...base,requiresPassword:true}} />);
  assert.match(html, /Create a password/);
  assert.match(html, /Confirm password/);
});
it("keeps a legacy single-dog preview readable", () => {
  const html = renderToStaticMarkup(<ConfirmAccountForm token="preview" preview={base} />);
  assert.ok(html.replaceAll("&amp;", "&").includes(`${appointment.petName} - ${appointment.serviceName}`));
});
it("provides a profile button to Complete your profile and removes the old landing copy", async () => {
  const html = renderToStaticMarkup(await ConfirmAccountPage({searchParams:Promise.resolve({token:"preview"})}));
  assert.match(html, /<a[^>]*href="\/account\/setup"[^>]*>Go to my profile<\/a>/);
  assert.doesNotMatch(html, /Return Home|Confirm Your Appointment|Review the reservation/);
  assert.ok(html.indexOf("Need to change something?") < html.indexOf("Go to my profile"));
});

it("shows the requested success message with the appointment date", () => {
  const html = renderToStaticMarkup(<AppointmentConfirmationSuccess appointmentDate="2026-10-28" />);
  assert.match(html, /Your appointment is confirmed\./);
  assert.match(html, /Thank you, see you on Wednesday, October 28, 2026!/);
  assert.doesNotMatch(html, /Complete your profile|Add rabies details/);
});
it("treats an expired saved card as missing and blocks confirmation", () => {
  const html = renderToStaticMarkup(<ConfirmAccountForm token="preview" preview={{...base,paymentMethods:[{...card,expYear:2020}]}} />);
  assert.doesNotMatch(html, /Visa •••• 1234/);
  assert.match(html, /href="\/account\/setup"[^>]*>Add a card/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Confirm<\/button>/);
});
it("keeps cards valid through the last Eastern day of the expiry month and skips expired defaults", () => {
  const expiring = {...card,expMonth:10,expYear:2026};
  assert.equal(usableConfirmationCards([expiring],new Date("2026-11-01T03:59:00Z")).length,1);
  assert.equal(usableConfirmationCards([expiring],new Date("2026-11-01T04:00:00Z")).length,0);
  const methods=usableConfirmationCards([expiring,{...card,id:"valid",isDefault:false}],new Date("2026-11-01T04:00:00Z"));
  assert.equal(preferredPaymentMethodId(methods),"valid");
});
