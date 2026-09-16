import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accountConfig } from "@/lib/account-fields";
import {
  buildAccountNavSummaries,
  formatAccountDate,
  formatCompletionStatus,
  formatPetNamesSummary,
  formatReferralCodeSummary,
  formatReferralRewardsSummary,
  hasCompletedServiceAddress,
  isCustomerProfileComplete,
  pickLastAppointmentDate,
} from "@/lib/account-nav-summaries";

describe("account nav summaries", () => {
  it("does not keep Messages from K9 Atelier in the customer menu", () => {
    assert.equal(
      accountConfig.sections.some((section) => section.id === "messages"),
      false,
    );
    assert.equal(
      accountConfig.sections.some((section) =>
        section.title.toLowerCase().includes("message"),
      ),
      false,
    );
  });

  it("marks personal information complete only when required fields are filled", () => {
    assert.equal(
      isCustomerProfileComplete({
        firstName: "Jane",
        lastName: "Miller",
        email: "jane@example.com",
        phone: "+15551234567",
      }),
      true,
    );
    assert.equal(
      isCustomerProfileComplete({
        firstName: "Jane",
        lastName: "",
        email: "jane@example.com",
        phone: "+15551234567",
      }),
      false,
    );
    assert.equal(formatCompletionStatus(true), "Completed");
    assert.equal(formatCompletionStatus(false), "Incomplete");
  });

  it("formats overview, pets, and referral credit summaries", () => {
    assert.equal(
      formatReferralCodeSummary(["  BELLA-JANE-M  ", "MAX-JANE-M"]),
      "Referral code: BELLA-JANE-M",
    );
    assert.equal(formatReferralCodeSummary(["", "  "]), null);
    assert.equal(formatPetNamesSummary(["Bella", " Max "]), "Bella, Max");
    assert.equal(formatPetNamesSummary([]), "None");
    assert.equal(formatReferralRewardsSummary(1250), "$12.50");
    assert.equal(formatReferralRewardsSummary(0), "$0.00");
  });

  it("picks the most recent past appointment, or the soonest upcoming if none", () => {
    assert.equal(
      pickLastAppointmentDate(
        [
          { appointmentDate: "2026-09-20", status: "confirmed" },
          { appointmentDate: "2026-08-01", status: "confirmed" },
          { appointmentDate: "2026-07-01", status: "cancelled" },
        ],
        "2026-09-16",
      ),
      "2026-08-01",
    );
    assert.equal(
      pickLastAppointmentDate(
        [
          { appointmentDate: "2026-09-20", status: "confirmed" },
          { appointmentDate: "2026-10-02", status: "pending_confirmation" },
        ],
        "2026-09-16",
      ),
      "2026-09-20",
    );
    assert.equal(pickLastAppointmentDate([], "2026-09-16"), null);
    assert.equal(formatAccountDate("2026-08-01"), "Aug 1, 2026");
  });

  it("treats a booked service address as completed", () => {
    assert.equal(
      hasCompletedServiceAddress([
        {
          appointmentDate: "2026-08-01",
          status: "confirmed",
          addressStreet: "123 Palm Avenue",
          addressCity: "Orlando",
          addressZip: "32801",
        },
      ]),
      true,
    );
    assert.equal(
      hasCompletedServiceAddress([
        {
          appointmentDate: "2026-08-01",
          status: "cancelled",
          addressStreet: "123 Palm Avenue",
          addressCity: "Orlando",
          addressZip: "32801",
        },
      ]),
      false,
    );
  });

  it("builds the menu summaries used on the account nav", () => {
    const summaries = buildAccountNavSummaries({
      profile: {
        firstName: "Jane",
        lastName: "Miller",
        email: "jane@example.com",
        phone: "+15551234567",
      },
      pets: [{ name: "Bella" }, { name: "Max" }],
      paymentMethodCount: 1,
      appointments: [
        {
          appointmentDate: "2026-08-12",
          status: "confirmed",
          addressStreet: "123 Palm Avenue",
          addressCity: "Orlando",
          addressZip: "32801",
        },
      ],
      referralCodes: ["BELLA-JANE-M"],
      availableCreditCents: 1800,
      today: "2026-09-16",
    });

    assert.equal(summaries.overview, "Referral code: BELLA-JANE-M");
    assert.equal(summaries.profile, "Completed");
    assert.equal(summaries.addresses, "Completed");
    assert.equal(summaries.pets, "Bella, Max");
    assert.equal(summaries.payment, "Completed");
    assert.equal(summaries.referrals, "$18.00");
    assert.equal(summaries.bookings, "Aug 12, 2026");
    assert.equal(summaries.password, null);
  });
});
