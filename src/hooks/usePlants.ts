import { useState, useEffect } from "react";
import { subscribePlants } from "@/lib/firestore";
import type { Plant } from "@/lib/types";

export function usePlants(): Plant[] {
  const [plants, setPlants] = useState<Plant[]>([]);

  useEffect(() => {
    return subscribePlants(setPlants);
  }, []);

  return plants;
}
