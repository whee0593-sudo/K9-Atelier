import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { metadata } from "@/app/faq/page";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const fees = readFileSync(
  new URL("../../components/services/FeesPoliciesSection.tsx", import.meta.url),
  "utf8",
);

const QUESTIONS = [
  "How does mobile grooming work?",
  "Do you groom dogs inside my home?",
  "Will my dog be kept in a cage or crate?",
  "Will my dog be around other dogs?",
  "Do I need to provide water or electricity?",
  "Where should the grooming van park?",
  "Do I need to be home during the appointment?",
  "How should I prepare for my appointment?",
  "What areas do you serve, and is there a travel fee?",
  "What are your hours, and how do I book?",
  "How long does a grooming appointment take?",
  "Is my appointment time exact?",
  "Do you groom dogs over 45 lbs?",
  "Do you groom puppies or senior dogs?",
  "What if my dog is nervous or has special needs?",
  "What vaccinations are required?",
  "Can I combine Luxury Spa Day with a Full Groom?",
  "Are your grooming and creative color products pet-safe?",
  "Why do I need to save a credit card?",
  "Can I pay with cash or Zelle?",
  "What is your cancellation and rescheduling policy?",
  "Are all the photos on this website your real work?",
  "How do Referral Rewards work?",
] as const;

describe("FAQ page", () => {
  it("keeps the public title and one page heading", () => {
    assert.equal(metadata.title, "FAQ · K9 Atelier");
    assert.match(String(metadata.description), /appointments, service area, payment/);
    assert.equal(page.match(/<h1\b/g), null);
    assert.match(page, /title="Questions About Your Appointment"/);
    assert.match(page, /<h2 /);
    assert.equal(page.includes("FAQPage"), false);
    assert.equal(page.includes("AggregateRating"), false);
  });

  it("publishes the 23 questions once as HTML summary text", () => {
    assert.equal(QUESTIONS.length, 23);
    assert.equal(new Set(QUESTIONS).size, QUESTIONS.length);
    for (const question of QUESTIONS) {
      const count = page.split(question).length - 1;
      assert.equal(count, 1, question);
    }
    assert.match(page, /<summary/);
    assert.match(page, /<h2/);
    assert.match(page, /<h3/);
  });

  it("keeps the confirmed policies and omits weekend and old travel copy", () => {
    assert.match(page, /Monday through Friday, from 9 AM to 5 PM/);
    assert.equal(/weekend/i.test(page), false);
    assert.equal(page.includes("more expensive than salon"), false);
    assert.equal(page.includes("Between 24 and 48"), false);
    assert.equal(page.includes("Less than 24 hours"), false);
    assert.match(page, /Two days before the appointment, or earlier/);
    assert.match(page, /The day before the appointment/);
    assert.match(page, /The day of the appointment/);
    assert.match(page, /confirmed service, priced add-ons, one travel fee/);
    assert.equal(page.includes("48 hours"), false);
    assert.match(page, /No-Shows/);
    assert.match(page, /within 15 minutes/);
    assert.match(page, /Delayed Access/);
    assert.match(page, /Illness or Emergencies/);
    assert.match(page, /Payment Method on File/);
    assert.match(page, /When a Service Cannot Be Completed/);
    assert.match(page, /50% of the scheduled service price/);
    assert.match(page, /you will not be charged/);
    assert.match(page, /cash or Zelle after grooming/);
    assert.match(page, /gladly accept cash and Zelle/);
    assert.match(page, /href="\/referrals"/);
    assert.match(page, /cannot be transferred, withdrawn, sold, or exchanged for cash/);
    assert.match(page, /in full or in part/);
    assert.match(page, /id="fees-policies"/);
    assert.match(fees, /Flea & Tick Treatment Fee|flea-tick-fee/);
    assert.match(fees, /Dematting/);
    assert.match(fees, /Dogs Over 45 lbs/);
    assert.match(fees, /Senior/);
    assert.match(fees, /standardServiceMiles/);
    assert.match(fees, /Beyond \{standardServiceMiles\} miles/);
    assert.equal(fees.includes("considered case by case"), false);
  });
});
