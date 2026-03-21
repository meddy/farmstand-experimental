import type { Timestamp } from "firebase/firestore";

export const SPACE_TYPES = ["Bucket", "Tray", "Trough", "Bin"] as const;

export type SpaceType = (typeof SPACE_TYPES)[number];

export const SLOT_STATES = [
  "Growing",
  "Prepped for Spring",
  "Fallow",
  "Pending Installation",
] as const;

export type SlotState = (typeof SLOT_STATES)[number] | null;

export const ACTIVITIES = [
  "Plant",
  "Transplant",
  "Fertilize",
  "Harvest",
  "Prep for Spring",
  "Install",
] as const;

export type Activity = (typeof ACTIVITIES)[number];

export interface Plant {
  id: string;
  number: string;
  name: string;
  type?: string;
  scientificName?: string;
}

export interface Slot {
  id: string;
  slotId: string;
  spaceType: SpaceType;
  subspace?: string;
  state: SlotState;
  lastActivity: Activity | null;
  lastChange: Timestamp;
  plantNumber: string | null;
  plantName: string | null;
  notes?: string;
  planChange?: Timestamp;
}

export interface WorkLog {
  id: string;
  plantNumber: string;
  plantName: string;
  date: Timestamp;
  spaceType: SpaceType;
  slotId: string;
  activity: Activity;
  notes?: string;
  createdAt: Timestamp;
}
