import { ACTIVITIES, type Activity } from "./types";
import type { Slot } from "./types";
import { isValidTransition, requiresPlantAssignment } from "./transitions";

/**
 * Returns a human-readable conflict reason if the slot cannot receive the work log,
 * or null if valid.
 */
export function getSlotConflict(
  slot: Slot,
  activity: Activity,
  plantNumber: string,
  plantName: string
): string | null {
  if (!isValidTransition(slot.state, activity)) {
    const validActivities = ACTIVITIES.filter((a) =>
      isValidTransition(slot.state, a as Activity)
    );
    const validStr = validActivities.length > 0 ? validActivities.join(", ") : "none";
    return `Activity "${activity}" is not valid for slot state "${slot.state}". Valid activities: ${validStr}.`;
  }

  if (requiresPlantAssignment(slot.state, activity)) {
    const plantTrimmed = plantNumber?.trim() && plantName?.trim();
    if (!plantTrimmed) {
      return "Plant is required for this activity.";
    }
  }

  return null;
}
