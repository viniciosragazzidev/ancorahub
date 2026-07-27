"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useCallback, useState } from "react";

type LocalFirstMutationOptions<TData, TVariables, TSnapshot> = {
  mutationFn: (variables: TVariables) => Promise<TData>;
  queryKeys?: readonly QueryKey[];
  onOptimistic?: (variables: TVariables) => TSnapshot | void;
  onRollback?: (snapshot: TSnapshot | undefined, error: unknown) => void;
  onConfirmed?: (data: TData) => void;
};

/**
 * Shared optimistic mutation contract. The UI changes before the network
 * response, errors restore the snapshot, and all related server queries are
 * invalidated after either outcome.
 */
export function useLocalFirstMutation<TData, TVariables, TSnapshot = unknown>(
  options: LocalFirstMutationOptions<TData, TVariables, TSnapshot>,
) {
  const queryClient = useQueryClient();
  const [syncError, setSyncError] = useState<unknown>(null);
  const mutation = useMutation({
    mutationFn: options.mutationFn,
    onMutate: (variables) => {
      setSyncError(null);
      return options.onOptimistic?.(variables);
    },
    onSuccess: (data) => {
      options.onConfirmed?.(data);
    },
    onError: (error, _variables, snapshot) => {
      setSyncError(error);
      options.onRollback?.(snapshot as TSnapshot | undefined, error);
    },
    onSettled: async () => {
      await Promise.all((options.queryKeys ?? []).map((key) => queryClient.invalidateQueries({ queryKey: key })));
    },
  });

  const resetSyncError = useCallback(() => setSyncError(null), []);
  return { ...mutation, syncError, resetSyncError };
}
