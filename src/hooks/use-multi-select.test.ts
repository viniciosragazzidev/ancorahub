// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMultiSelect } from "./use-multi-select";

const ALL_IDS = ["a", "b", "c"];

describe("useMultiSelect", () => {
  it("starts with empty selection", () => {
    const { result } = renderHook(() => useMultiSelect(ALL_IDS));
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.count).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
  });

  it("toggles a single id", () => {
    const { result } = renderHook(() => useMultiSelect(ALL_IDS));

    act(() => result.current.toggle("a"));
    expect(result.current.selectedIds).toEqual(["a"]);
    expect(result.current.count).toBe(1);
    expect(result.current.isAllSelected).toBe(false);

    act(() => result.current.toggle("a"));
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it("toggles multiple ids independently", () => {
    const { result } = renderHook(() => useMultiSelect(ALL_IDS));

    act(() => result.current.toggle("a"));
    act(() => result.current.toggle("c"));
    expect(result.current.selectedIds).toEqual(["a", "c"]);
    expect(result.current.count).toBe(2);

    act(() => result.current.toggle("a"));
    expect(result.current.selectedIds).toEqual(["c"]);
    expect(result.current.count).toBe(1);
  });

  it("selects all when selectAll is called", () => {
    const { result } = renderHook(() => useMultiSelect(ALL_IDS));

    act(() => result.current.selectAll());
    expect(result.current.selectedIds).toEqual(ALL_IDS);
    expect(result.current.count).toBe(3);
    expect(result.current.isAllSelected).toBe(true);
  });

  it("deselects all when selectAll is called twice", () => {
    const { result } = renderHook(() => useMultiSelect(ALL_IDS));

    act(() => result.current.selectAll());
    act(() => result.current.selectAll());
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.count).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
  });

  it("clears selection", () => {
    const { result } = renderHook(() => useMultiSelect(ALL_IDS));

    act(() => result.current.toggle("a"));
    act(() => result.current.toggle("b"));
    act(() => result.current.clear());
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it("reports isSelected correctly", () => {
    const { result } = renderHook(() => useMultiSelect(ALL_IDS));

    expect(result.current.isSelected("a")).toBe(false);
    act(() => result.current.toggle("a"));
    expect(result.current.isSelected("a")).toBe(true);
    expect(result.current.isSelected("b")).toBe(false);
  });

  it("reports isAllSelected correctly with partial selection", () => {
    const { result } = renderHook(() => useMultiSelect(ALL_IDS));

    act(() => result.current.toggle("a"));
    expect(result.current.isAllSelected).toBe(false);
  });

  it("handles empty id list", () => {
    const { result } = renderHook(() => useMultiSelect([]));

    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.count).toBe(0);
    expect(result.current.isAllSelected).toBe(false);

    // selectAll on empty list selects nothing (guard allIds.length > 0)
    act(() => result.current.selectAll());
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.isAllSelected).toBe(false);
  });

  it("setSelected replaces the selection", () => {
    const { result } = renderHook(() => useMultiSelect(ALL_IDS));

    act(() => result.current.setSelected(["a", "c"]));
    expect(result.current.selectedIds).toEqual(["a", "c"]);
    expect(result.current.count).toBe(2);
  });

  it("selectAll picks up newly added ids", () => {
    const { result } = renderHook(() => useMultiSelect(["x", "y"]));

    act(() => result.current.selectAll());
    expect(result.current.selectedIds).toEqual(["x", "y"]);

    // simulate re-render with larger list
    const { result: result2 } = renderHook(() =>
      useMultiSelect(["x", "y", "z"]),
    );

    act(() => result2.current.selectAll());
    expect(result2.current.selectedIds).toEqual(["x", "y", "z"]);
  });
});
