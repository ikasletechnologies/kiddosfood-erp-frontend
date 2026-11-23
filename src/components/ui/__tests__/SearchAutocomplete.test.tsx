import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useState } from "react";
import SearchAutocomplete from "../SearchAutocomplete";
import { useAsyncSearch } from "@/lib/hooks/useSearch";
import { dedupeById, matchesSearch, normalizeSearch } from "@/lib/search";

type Row = { id: string; name: string; disabled?: boolean };
const ROWS: Row[] = [
  { id: "1", name: "Rice" },
  { id: "2", name: "Ragi", disabled: true },
  { id: "3", name: "Rava" },
  { id: "1", name: "Rice (duplicate)" },
];

function Harness({ onSelect, options = ROWS, loading = false }: { onSelect: (r: Row) => void; options?: Row[]; loading?: boolean }) {
  const [text, setText] = useState("");
  return (
    <div>
      <SearchAutocomplete<Row>
        label="Product"
        value={text}
        onInputChange={setText}
        options={options.filter(r => matchesSearch(text, r.name))}
        getOptionKey={r => r.id}
        renderOption={r => <span>{r.name}</span>}
        isOptionDisabled={r => !!r.disabled}
        onSelect={r => { onSelect(r); setText(r.name); }}
        onClear={() => setText("")}
        loading={loading}
      />
      <button type="button">outside</button>
    </div>
  );
}

describe("search helpers", () => {
  it("trims and is case-insensitive", () => {
    expect(normalizeSearch("  RiCe   Flour ")).toBe("rice flour");
    expect(matchesSearch("  RICE ", "Basmati rice")).toBe(true);
    expect(matchesSearch("", "anything")).toBe(true);
    expect(matchesSearch("x", null, undefined, "abc")).toBe(false);
  });
  it("de-duplicates by id", () => {
    expect(dedupeById(ROWS).map(r => r.id)).toEqual(["1", "2", "3"]);
  });
});

describe("SearchAutocomplete", () => {
  it("is an accessible combobox with keyboard navigation that selects the record (id), skipping disabled options", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const input = screen.getByRole("combobox", { name: "Product" });
    fireEvent.change(input, { target: { value: "r" } });
    expect(input).toHaveAttribute("aria-expanded", "true");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3); // duplicate id 1 removed
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowDown" }); // skips disabled Ragi
    expect(screen.getAllByRole("option")[2]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith({ id: "1", name: "Rice" });
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("does not select a disabled option on click", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "ra" } });
    fireEvent.click(screen.getByText("Ragi"));
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Rava"));
    expect(onSelect).toHaveBeenCalledWith({ id: "3", name: "Rava" });
  });

  it("closes on Escape and on click outside", () => {
    render(<Harness onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "r" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveAttribute("aria-expanded", "false");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-expanded", "true");
    fireEvent.mouseDown(screen.getByText("outside"));
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the empty and loading texts", () => {
    const { rerender } = render(<Harness onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzz" } });
    expect(screen.getByText("No matching records found")).toBeInTheDocument();
    rerender(<Harness onSelect={vi.fn()} loading />);
    expect(screen.getByText("Searching…")).toBeInTheDocument();
  });

  it("clear button resets the text", () => {
    render(<Harness onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "rice" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear Product" }));
    expect(input).toHaveValue("");
  });
});

describe("useAsyncSearch", () => {
  it("debounces, trims, skips duplicate queries and ignores stale responses", async () => {
    vi.useFakeTimers();
    const resolvers: Record<string, (rows: string[]) => void> = {};
    const fetcher = vi.fn((q: string) => new Promise<string[]>(res => { resolvers[q] = res; }));
    const { result, rerender } = renderHook(({ query }) => useAsyncSearch<string>({ query, fetcher }), { initialProps: { query: "" } });

    rerender({ query: "r" });
    rerender({ query: "ri" });
    rerender({ query: " ric " });
    expect(result.current.loading).toBe(true); // typed but not yet searched
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenLastCalledWith("ric");

    // Same trimmed text again -> no new request.
    rerender({ query: "ric  " });
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(fetcher).toHaveBeenCalledTimes(1);

    rerender({ query: "rice" });
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(fetcher).toHaveBeenCalledTimes(2);

    // Newer response first, then the stale one: stale must not win.
    await act(async () => { resolvers["rice"](["Rice"]); });
    await act(async () => { resolvers["ric"](["STALE"]); });
    expect(result.current.results).toEqual(["Rice"]);
    expect(result.current.loading).toBe(false);
    vi.useRealTimers();
  });
});
