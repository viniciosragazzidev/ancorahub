"use client";

import dynamic from "next/dynamic";

const DirectorLiteStyles = dynamic(() =>
  import("./director-lite-styles").then((module) => module.DirectorLiteStyles),
);

export function DirectorLiteStyleGate({ enabled }: { enabled: boolean }) {
  return enabled ? <DirectorLiteStyles /> : null;
}
