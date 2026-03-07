import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { AppShell } from "@/components/layout/AppShell";

const WorkLog = lazy(() =>
  import("@/pages/WorkLog").then((m) => ({ default: m.WorkLog }))
);
const LookupBySpace = lazy(() =>
  import("@/pages/LookupBySpace").then((m) => ({ default: m.LookupBySpace }))
);
const LookupByPlant = lazy(() =>
  import("@/pages/LookupByPlant").then((m) => ({ default: m.LookupByPlant }))
);

function App() {
  return (
    <AuthGuard>
      <Toaster />
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<WorkLog />} />
            <Route path="lookup-space" element={<LookupBySpace />} />
            <Route path="lookup-plant" element={<LookupByPlant />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </AuthGuard>
  );
}

export { App };
