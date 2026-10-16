import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RecipeUploadsTab from "../RecipeUploadsTab";

const { list, push } = vi.hoisted(() => ({ list: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/api", () => ({ recipeImportsApi: { list } }));

const session = (overrides: Record<string, unknown> = {}) => ({
  id: "upload-1",
  fileName: "recipes.docx",
  createdAt: "2026-10-16T10:00:00.000Z",
  updatedAt: "2026-10-16T10:05:00.000Z",
  total: 3,
  imported: 3,
  pending: 0,
  skipped: 0,
  recipes: [],
  ...overrides,
});

describe("RecipeUploadsTab", () => {
  beforeEach(() => {
    list.mockReset();
    push.mockReset();
  });
  afterEach(cleanup);

  it("shows successful and processing uploads with actual counts", async () => {
    list.mockResolvedValue({ data: [session(), session({ id: "upload-2", fileName: "pending.docx", imported: 1, pending: 2 })] });
    render(<RecipeUploadsTab />);
    expect(await screen.findByText("recipes.docx")).toBeInTheDocument();
    expect(screen.getByText("pending.docx")).toBeInTheDocument();
    expect(screen.getAllByText("Success").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Processing").length).toBeGreaterThan(1);
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
  });

  it("shows the empty-history state", async () => {
    list.mockResolvedValue({ data: [] });
    render(<RecipeUploadsTab />);
    expect(await screen.findByText("No recipe uploads yet")).toBeInTheDocument();
  });

  it("shows a safe error state when history cannot load", async () => {
    list.mockRejectedValue({ response: { data: { error: "History unavailable" } } });
    render(<RecipeUploadsTab />);
    expect(await screen.findByText("History unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("opens the existing upload workflow", async () => {
    list.mockResolvedValue({ data: [] });
    render(<RecipeUploadsTab />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    screen.getByRole("button", { name: "Upload Recipe" }).click();
    expect(push).toHaveBeenCalledWith("/production/recipes/import");
  });
});
