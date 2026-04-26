import type { Activity, SlotState } from "./types";

/**
 * State transition table: given current state and activity, returns the resulting state
 * or null if the transition is invalid.
 */
const TRANSITIONS: Record<string, Record<string, SlotState>> = {
  null: {
    Plant: "Growing",
    Fertilize: null,
    Amend: null,
    "Prep for Spring": "Prepped for Spring",
    Transplant: "Fallow",
    Install: "Pending Installation",
  },
  Growing: {
    Transplant: "Fallow",
    Fertilize: "Growing",
    Amend: "Growing",
    Flip: null,
    Pick: "Growing",
    "Prep for Spring": "Prepped for Spring",
    Plant: null, // impossible
    Install: null, // impossible
  },
  "Prepped for Spring": {
    Plant: "Growing",
    Transplant: null,
    Fertilize: "Prepped for Spring",
    Amend: "Prepped for Spring",
    Flip: null,
    Pick: null,
    "Prep for Spring": "Prepped for Spring",
    Install: null,
  },
  Fallow: {
    Plant: "Growing",
    Transplant: null,
    Fertilize: "Fallow",
    Amend: "Fallow",
    Flip: null,
    Pick: null,
    "Prep for Spring": "Prepped for Spring",
    Install: null,
  },
  "Pending Installation": {
    Plant: "Growing",
    Transplant: null,
    Fertilize: "Pending Installation",
    Amend: "Pending Installation",
    Flip: null,
    Pick: null,
    "Prep for Spring": "Prepped for Spring",
    Install: null,
  },
  Seed: {
    Transplant: "Fallow",
    Plant: "Seed",
    Flip: null,
    Pick: null,
    "Prep for Spring": null,
    Install: null,
  },
};

function getKey(state: SlotState): string {
  return state ?? "null";
}

export function isValidTransition(
  currentState: SlotState,
  activity: Activity
): boolean {
  const stateKey = getKey(currentState);
  const transitions = TRANSITIONS[stateKey];
  if (!transitions) return false;
  return transitions[activity] !== undefined;
}

export function getNextState(currentState: SlotState, activity: Activity): SlotState {
  const stateKey = getKey(currentState);
  const transitions = TRANSITIONS[stateKey];
  if (!transitions) return null;
  return transitions[activity] ?? null;
}

export function requiresPlantAssignment(
  currentState: SlotState,
  activity: Activity
): boolean {
  const next = getNextState(currentState, activity);
  return next === "Growing";
}

export function isWorkLogOnlyActivity(
  currentState: SlotState,
  activity: Activity
): boolean {
  if (activity !== "Fertilize" && activity !== "Amend") return false;
  return currentState !== "Seed";
}
