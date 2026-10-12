import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home page", () => {
  it("renders the platform marketing hero", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: /projectflow/i })).toBeInTheDocument();
    expect(screen.getByText(/turn plans into momentum/i)).toBeInTheDocument();
  });
});
