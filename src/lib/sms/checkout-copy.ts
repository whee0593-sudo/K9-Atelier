import { formatVisitPetNames } from "@/lib/visits/pet-names";

export function petHomePronoun(sex?: string | null) {
  const value = (sex ?? "").trim().toLowerCase();
  if (!value) return "them";
  if (value.includes("female")) return "her";
  if (value.includes("male")) return "him";
  if (value === "f" || value.startsWith("f,") || value.startsWith("f ")) {
    return "her";
  }
  if (value === "m" || value.startsWith("m,") || value.startsWith("m ")) {
    return "him";
  }
  return "them";
}

export function buildCheckoutReadySms(input: {
  petName?: string | null;
  sex?: string | null;
  petNames?: Array<string | null | undefined>;
}) {
  const names = (input.petNames ?? []).map((name) => name?.trim()).filter(Boolean);
  if (names.length > 1) {
    const label = formatVisitPetNames(names, "your pets");
    return [
      `K9 ATELIER: ${label} are ready to come home! We’ll bring them to your door shortly. Thank you for trusting us with their care!`,
      "",
      "Reply STOP to opt out.",
    ].join("\n");
  }
  const petName = input.petName?.trim() || names[0] || "your pet";
  const pronoun = petHomePronoun(input.sex);
  return [
    `K9 ATELIER: ${petName} is ready to come home! We’ll bring ${pronoun} to your door shortly. Thank you for trusting us with ${petName}’s care!`,
    "",
    "Reply STOP to opt out.",
  ].join("\n");
}
