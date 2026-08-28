"use client";

import { useEffect, useRef } from "react";

export type ActionDialogResult = {
  success?: boolean;
  error?: string;
  message?: string;
  mutationId?: string;
};

/**
 * Treats every completed Server Action response exactly once. A mutation id
 * prevents an old success/error from reopening or reclosing a dialog after it
 * has been remounted, while `useActionState` remains the source of pending.
 */
export function useActionDialogLifecycle<T extends ActionDialogResult>(input: {
  state: T;
  pending: boolean;
  onSuccess: (state: T) => void;
  onError: (state: T) => void;
}) {
  const handledMutationId = useRef<string | null>(null);
  const latestState = useRef<T>(input.state);
  const { state, pending, onSuccess, onError } = input;
  const { mutationId, success, error } = state;
  latestState.current = state;

  useEffect(() => {
    if (pending || !mutationId || handledMutationId.current === mutationId) return;

    handledMutationId.current = mutationId;
    if (success) onSuccess(latestState.current);
    else if (error) onError(latestState.current);
  }, [error, mutationId, onError, onSuccess, pending, success]);
}
