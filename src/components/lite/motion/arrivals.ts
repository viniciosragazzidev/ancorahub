"use client";

import { useState } from "react";

/**
 * Chaves que chegaram depois da primeira montagem (ex.: lead novo entrando na lista "Agora" pelo refresh).
 * Só elas ganham a mola de chegada (follow-through); o que já estava na tela ao abrir não balança.
 */
export function arrivedKeys(initial: ReadonlySet<string>, current: readonly string[]) {
  return new Set(current.filter((key) => !initial.has(key)));
}

export function useArrivedKeys(keys: readonly string[]) {
  const [initial] = useState(() => new Set(keys));
  return arrivedKeys(initial, keys);
}
