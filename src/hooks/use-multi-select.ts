"use client";

import { useCallback, useMemo, useState } from "react";

export function useMultiSelect(allIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const isAllSelected = useMemo(
    () => allIds.length > 0 && selectedIds.length === allIds.length,
    [allIds.length, selectedIds.length],
  );

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.length === allIds.length ? [] : [...allIds],
    );
  }, [allIds]);

  const clear = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const setSelected = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.includes(id),
    [selectedIds],
  );

  return {
    selectedIds,
    count: selectedIds.length,
    isAllSelected,
    toggle,
    selectAll,
    clear,
    isSelected,
    setSelected,
  } as const;
}
