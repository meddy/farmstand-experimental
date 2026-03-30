import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Timestamp } from "firebase/firestore";
import { WorkLogSections } from "@/components/WorkLogSections";
import type { WorkLog } from "@/lib/types";

function dateTs(d: Date): Timestamp {
  return { toDate: () => d } as Timestamp;
}

function makeLog(overrides: Partial<WorkLog> & Pick<WorkLog, "id">): WorkLog {
  return {
    plantNumber: "1",
    plantName: "Herb",
    date: dateTs(new Date(2025, 5, 15)),
    spaceType: "Bucket",
    slotId: "SLOT-A",
    activity: "Plant",
    createdAt: dateTs(new Date(2025, 5, 15)),
    ...overrides,
  };
}

describe("WorkLogSections", () => {
  it("renders quarter headings in descending year-quarter order", () => {
    const map = new Map<string, WorkLog[]>();
    map.set("2024-Q1", [makeLog({ id: "a" })]);
    map.set("2025-Q2", [makeLog({ id: "b" })]);
    render(<WorkLogSections groupedLogs={map} onDeleteWorklog={() => {}} />);
    const headings = screen.getAllByRole("heading", { level: 4 });
    expect(headings.map((h) => h.textContent)).toEqual(["2025-Q2", "2024-Q1"]);
  });

  it("with anchor plant shows slot id as secondary", () => {
    const map = new Map<string, WorkLog[]>();
    map.set("2025-Q1", [makeLog({ id: "x" })]);
    render(
      <WorkLogSections groupedLogs={map} onDeleteWorklog={() => {}} anchor="plant" />
    );
    expect(screen.getByText(/@ SLOT-A/)).toBeInTheDocument();
  });

  it("with anchor slot shows plant name and number as secondary", () => {
    const map = new Map<string, WorkLog[]>();
    map.set("2025-Q1", [makeLog({ id: "x", plantName: "Rose", plantNumber: "99" })]);
    render(
      <WorkLogSections groupedLogs={map} onDeleteWorklog={() => {}} anchor="slot" />
    );
    expect(screen.getByText(/Rose #99/)).toBeInTheDocument();
  });

  it("calls onDeleteWorklog when delete is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const log = makeLog({ id: "del-1" });
    const map = new Map<string, WorkLog[]>();
    map.set("2025-Q1", [log]);
    render(<WorkLogSections groupedLogs={map} onDeleteWorklog={onDelete} />);
    await user.click(
      screen.getByRole("button", { name: /Delete work log: Plant 6\/15\/2025/i })
    );
    expect(onDelete).toHaveBeenCalledWith(log);
  });
});
