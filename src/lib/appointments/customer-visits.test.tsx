import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomerVisitCard } from "@/components/account/CustomerBookingsList";
import { customerBookingVisits, customerVisitEstimate, customerAppointmentServiceLines } from "./customer-visits";
import { mapAppointmentRowToRecord } from "./map";
import type { AppointmentRecord, AppointmentRow } from "./types";

(globalThis as { React?: typeof React }).React = React;
function appointment(id: string, overrides: Partial<AppointmentRecord> = {}): AppointmentRecord {
  return {
    id, customerId:"owner",petId:id,petName:id,petBreed:"Poodle",
    serviceId:"custom-full-haircut",serviceName:"Custom Full Haircut & Styling",addOnIds:[],addOnOptions:{},
    addressStreet:"100 Example Avenue",addressCity:"Jupiter",addressState:"FL",addressZip:"33458",
    travelDistanceMiles:0,travelFee:0,appointmentDate:"2099-10-30",appointmentTime:"9:00–11:38 AM",
    scheduledStart:540,timePreference:"morning",timezone:"America/New_York",estimatedTotal:140,
    newClientDeposit:null,vaccinationStatusAtBooking:null,status:"confirmed",confirmedAt:null,
    customerConfirmedAt:null,createdAt:"2026-10-30T00:00:00Z",visitId:"visit-1",...overrides,
  };
}

describe("customer booking visits", () => {
  it("groups only explicit visits and orders dogs by their scheduled care", () => {
    const rows=[appointment("Bella",{scheduledStart:623}),appointment("Lychee"),appointment("Other visit",{visitId:"visit-2"}),appointment("Legacy 1",{visitId:null}),appointment("Legacy 2",{visitId:null})];
    const groups=customerBookingVisits(rows);
    assert.equal(groups.length,4);
    assert.deepEqual(groups[0].map(p=>p.petName),["Lychee","Bella"]);
    assert.equal(rows[0].petName,"Bella");
  });
  it("totals saved prices to cents and does not add travel twice", () => {
    const pets=[appointment("Lychee",{estimatedTotal:153.25,travelFee:13.25}),appointment("Bella",{estimatedTotal:160})];
    assert.equal(customerVisitEstimate(pets),313.25);
    assert.equal(customerVisitEstimate([appointment("missing",{estimatedTotal:null}),pets[0]]),null);
    assert.equal(customerVisitEstimate([appointment("cancelled",{status:"cancelled"})]),null);
    assert.equal(customerVisitEstimate([pets[0],appointment("cancelled",{status:"cancelled"})]),153.25);
  });
  it("uses frozen add-on prices and keeps legacy combined estimates honest", () => {
    const pet=appointment("Lychee",{estimatedTotal:203,travelFee:13,addOnIds:["creative-accent-coloring"],pricedAddOns:[{id:"creative-accent-coloring",label:"Temporary Fun",amount:50}]});
    assert.deepEqual(customerAppointmentServiceLines(pet),[{name:pet.serviceName,amount:140},{name:"Temporary Fun",amount:50}]);
    const legacy={...pet,pricedAddOns:null};
    assert.equal(customerAppointmentServiceLines(legacy).length,1);
    assert.equal(customerAppointmentServiceLines(legacy)[0].amount,190);
  });
  it("exposes the stored add-on snapshot without leaking reserved options", () => {
    const mapped=mapAppointmentRowToRecord({id:"row",add_on_options:{"creative-accent-coloring":"Temporary Fun",__pricedAddOns:[{id:"color",label:"Temporary Fun",amount:50}]},estimated_total:190} as unknown as AppointmentRow);
    assert.deepEqual(mapped.pricedAddOns,[{id:"color",label:"Temporary Fun",amount:50}]);
    assert.deepEqual(mapped.addOnOptions,{"creative-accent-coloring":"Temporary Fun"});
  });
  it("shows one card total, status, and change button for the entire visit", () => {
    const pets=[appointment("LYCHEE"),appointment("BELLA",{estimatedTotal:160,serviceName:"Hand Stripping",scheduledStart:623})];
    const html=renderToStaticMarkup(<CustomerVisitCard appointments={pets}/>);
    assert.equal((html.match(/<li /g)??[]).length,1);
    assert.equal((html.match(/Estimated Total/g)??[]).length,1);
    assert.equal((html.match(/>Confirmed</g)??[]).length,1);
    assert.match(html,/\$300\.00/);
    assert.match(html,/href="\/account\/appointments\/LYCHEE"/);
    assert.equal((html.match(/href="\/account\/appointments\//g)??[]).length,1);
    assert.match(html,/>Change this appointment</);
    assert.equal(html.includes("Change or cancel"),false);
    assert.equal(html.includes("Travel Fee"),false);
    assert.equal(html.includes("Estimated from"),false);
  });
  it("keeps partial cancellation visible and prevents a false complete estimate", () => {
    const html=renderToStaticMarkup(<CustomerVisitCard appointments={[appointment("LYCHEE",{estimatedTotal:null}),appointment("BELLA",{status:"cancelled"})]}/>);
    assert.match(html,/Partially cancelled/);
    assert.match(html,/>Cancelled</);
    assert.match(html,/Estimate to be confirmed/);
    assert.equal(html.includes('href="/account/appointments/BELLA"'),false);
  });
});
