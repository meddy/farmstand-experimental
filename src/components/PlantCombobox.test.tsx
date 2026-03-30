import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Plant } from "@/lib/types";
import { PlantCombobox } from "@/components/PlantCombobox";

const mockPlants: Plant[] = [
  { id: "1", number: "9200", name: "Rosemary" },
  { id: "2", number: "1050", name: "Basil Buddy" },
  ...Array.from({ length: 55 }, (_, i) => ({
    id: `extra-${i}`,
    number: `9${String(i).padStart(3, "0")}`,
    name: `Plant ${i}`,
  })),
];

vi.mock("@/hooks/usePlants", () => ({
  usePlants: () => mockPlants,
}));

describe("PlantCombobox", () => {
  it("filters list by number prefix when typing in search", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PlantCombobox value={{ number: "92", name: "" }} onChange={onChange} />);
    await user.click(screen.getByRole("combobox"));
    const input = screen.getByPlaceholderText(/9200|92/);
    await user.clear(input);
    await user.type(input, "92");
    expect(screen.getByText(/9200 — Rosemary/)).toBeInTheDocument();
    expect(screen.queryByText(/1050 — Basil/)).not.toBeInTheDocument();
  });

  it("filters list by plant name substring", async () => {
    const user = userEvent.setup();
    render(<PlantCombobox value={{ number: "bas", name: "" }} onChange={() => {}} />);
    await user.click(screen.getByRole("combobox"));
    expect(screen.getByText(/1050 — Basil Buddy/)).toBeInTheDocument();
  });

  it("calls onChange with number and name when a plant is chosen", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PlantCombobox value={{ number: "", name: "" }} onChange={onChange} />);
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText(/9200 — Rosemary/));
    expect(onChange).toHaveBeenCalledWith({ number: "9200", name: "Rosemary" });
  });

  it("shows Clear only when optional and there is a selection", () => {
    const { rerender } = render(
      <PlantCombobox
        optional
        label={<span>Label</span>}
        value={{ number: "", name: "" }}
        onChange={() => {}}
      />
    );
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
    rerender(
      <PlantCombobox
        optional
        label={<span>Label</span>}
        value={{ number: "9200", name: "Rosemary" }}
        onChange={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  it("does not show Clear when not optional", () => {
    render(
      <PlantCombobox value={{ number: "9200", name: "Rosemary" }} onChange={() => {}} />
    );
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
  });

  it("caps visible options at 50", async () => {
    const user = userEvent.setup();
    render(<PlantCombobox value={{ number: "9", name: "" }} onChange={() => {}} />);
    await user.click(screen.getByRole("combobox"));
    const items = screen.getAllByRole("option");
    expect(items.length).toBe(50);
  });
});
