import { canonicalServiceId, isLuxurySpaDay } from "@/lib/service-catalog";

export const SPA_GOALS = [
  {
    id: "sensitive-skin",
    title: "Sensitive Skin",
    description: "Gentle care for sensitive skin.",
  },
  {
    id: "shedding-coat",
    title: "Shedding & Coat Care",
    description: "Reduce loose hair and maintain the coat.",
  },
  {
    id: "relaxation-comfort",
    title: "Relaxation & Comfort",
    description: "A calm, soothing spa experience.",
  },
  {
    id: "shiny-fabulous",
    title: "Shiny & Fabulous",
    description: "A smooth, shiny coat with a fresh, pleasant scent.",
  },
] as const;

export type SpaGoalId = (typeof SPA_GOALS)[number]["id"];

export const SPA_GOAL_HEADING = "What would you like us to focus on?";
export const SPA_GOAL_NOTE =
  "Select your pup's spa goals. We'll choose the treatments.";
export const ESSENTIAL_OILS_HEADING = "A NOTE ABOUT ESSENTIAL OILS";
export const ESSENTIAL_OILS_BODY =
  "We use only natural, organic essential oils. Please let us know about any known allergies or sensitivities affecting your pup or anyone in your household.";

const SPA_GOAL_IDS = new Set<string>(SPA_GOALS.map((goal) => goal.id));

export function isSpaGoalId(value: string): value is SpaGoalId {
  return SPA_GOAL_IDS.has(value);
}

export function spaGoalTitle(id: string) {
  return SPA_GOALS.find((goal) => goal.id === id)?.title ?? id;
}

/** Empty is allowed. Duplicate ids collapse. Unknown ids are rejected. */
export function parseSpaGoals(
  value: unknown,
): { ok: true; goals: SpaGoalId[] } | { ok: false; message: string } {
  if (value == null) return { ok: true, goals: [] };
  if (!Array.isArray(value)) {
    return { ok: false, message: "Spa goals are invalid." };
  }
  const goals: SpaGoalId[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !isSpaGoalId(item)) {
      return { ok: false, message: "Spa goals are invalid." };
    }
    if (!goals.includes(item)) goals.push(item);
  }
  return { ok: true, goals };
}

/**
 * Goals belong only to Luxury Spa Day. They are not add-ons and do not
 * change the package price. Any other service must send none.
 */
export function spaGoalsForService(
  serviceId: string,
  value: unknown,
): { ok: true; goals: SpaGoalId[] } | { ok: false; message: string } {
  const parsed = parseSpaGoals(value);
  if (!parsed.ok) return parsed;
  const canonical = canonicalServiceId(serviceId);
  if (!isLuxurySpaDay(canonical)) {
    if (parsed.goals.length > 0) {
      return {
        ok: false,
        message: "Spa goals can only be saved with Luxury Spa Day.",
      };
    }
    return { ok: true, goals: [] };
  }
  return parsed;
}
