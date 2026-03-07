import type { Activity, SlotState } from "./types";

/**
 * State transition table: given current state and activity, returns the resulting state
 * or null if the transition is invalid.
 */
const TRANSITIONS: Record<string, Record<string, SlotState>> = {
  Growing: {
    Transplant: "Fallow",
    Fertilize: "Growing",
    Harvest: null,
    "Prep for Spring": "Prepped for Spring",
    Plant: null, // impossible
    Install: null, // impossible
  },
  "Prepped for Spring": {
    Plant: "Growing",
    Transplant: null,
    Fertilize: null,
    Harvest: null,
    "Prep for Spring": "Prepped for Spring",
    Install: null,
  },
  Fallow: {
    Plant: "Growing",
    Transplant: null,
    Fertilize: null,
    Harvest: null,
    "Prep for Spring": "Prepped for Spring",
    Install: null,
  },
  "Pending Installation": {
    Plant: "Growing",
    Transplant: null,
    Fertilize: null,
    Harvest: null,
    "Prep for Spring": "Prepped for Spring",
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
