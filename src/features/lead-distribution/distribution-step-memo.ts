export type AsyncStepMemo<T> = (key: string, load: () => Promise<T>) => Promise<T>;

export function createAsyncStepMemo<T>(): AsyncStepMemo<T> {
  const values = new Map<string, Promise<T>>();

  return (key, load) => {
    const cached = values.get(key);
    if (cached) return cached;

    const pending = Promise.resolve().then(load);
    values.set(key, pending);
    void pending.catch(() => {
      if (values.get(key) === pending) values.delete(key);
    });
    return pending;
  };
}

export function createDistributionStepMemo<Roster>() {
  return {
    rosters: createAsyncStepMemo<Roster>(),
    fallbackBranches: createAsyncStepMemo<string[]>(),
  };
}
