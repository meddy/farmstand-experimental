import { lazy } from "react";
import { Route } from "react-router-dom";
import { V2Shell } from "@/v2/components/layout/V2Shell";

const V2Home = lazy(() =>
  import("@/v2/pages/V2Home").then((m) => ({ default: m.V2Home }))
);
const PlantSearchPage = lazy(() =>
  import("@/v2/pages/PlantSearchPage").then((m) => ({
    default: m.PlantSearchPage,
  }))
);
const SpaceSearchPage = lazy(() =>
  import("@/v2/pages/SpaceSearchPage").then((m) => ({
    default: m.SpaceSearchPage,
  }))
);
const RunReportsPage = lazy(() =>
  import("@/v2/pages/RunReportsPage").then((m) => ({
    default: m.RunReportsPage,
  }))
);
const WorkLogPage = lazy(() =>
  import("@/v2/pages/WorkLogPage").then((m) => ({ default: m.WorkLogPage }))
);

export const v2Route = (
  <Route path="/v2" element={<V2Shell />}>
    <Route index element={<V2Home />} />
    <Route path="plant-search" element={<PlantSearchPage />} />
    <Route path="space-search" element={<SpaceSearchPage />} />
    <Route path="run-reports" element={<RunReportsPage />} />
    <Route path="work-log" element={<WorkLogPage />} />
  </Route>
);
