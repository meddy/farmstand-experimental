import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("renders and handles click", async () => {
    const user = userEvent.setup();
    let clicked = false;
    render(
      <Button
        type="button"
        onClick={() => {
          clicked = true;
        }}
      >
        Save
      </Button>
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(clicked).toBe(true);
  });
});
