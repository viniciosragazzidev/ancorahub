import { notFound } from "next/navigation";

import "@/components/arc/venancor-scope.css";
import "@/components/arc/director-skin.css";
import "@/components/arc/director-primitives.css";
import PrimitivesCatalog from "@/app/(dashboard)/internal/design-system/primitives-catalog";
import { DirectorPrimitivesPreviewViewport } from "./preview-viewport";

export default function DirectorPrimitivesPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DirectorPrimitivesPreviewViewport><PrimitivesCatalog /></DirectorPrimitivesPreviewViewport>;
}
