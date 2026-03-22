import type { Activity, SlotState } from "./types";

/**
 * State transition table: given current state and activity, returns the resulting state
 * or null if the transition is invalid.
 */
const TRANSITIONS: Record<string, Record<string, SlotState>> = {
  null: {
    Plant: "Growing",
    "Prep for Spring": "Prepped for Spring",
    Transplant: "Fallow",
    Install: "Pending Installation",
  },
  Growing: {
    Transplant: "Fallow",
    Fertilize: "Growing",
    Flip: null,
    Pick: "Growing",
    "Prep for Spring": "Prepped for Spring",
    Plant: null, // impossible
    Install: null, // impossible
  },
  "Prepped for Spring": {
    Plant: "Growing",
    Transplant: null,
    Fertilize: null,
    Flip: null,
    Pick: null,
    "Prep for Spring": "Prepped for Spring",
    Install: null,
  },
  Fallow: {
    Plant: "Growing",
    Transplant: null,
    Fertilize: null,
    Flip: null,
    Pick: null,
    "Prep for Spring": "Prepped for Spring",
    Install: null,
  },
  "Pending Installation": {
    Plant: "Growing",
    Transplant: null,
    Fertilize: null,
    Flip: null,
    Pick: null,
    "Prep for Spring": "Prepped for Spring",
    Install: null,
  },
  Seed: {
    Transplant: "Fallow",
    Plant: "Seed",
    Fertilize: null,
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
