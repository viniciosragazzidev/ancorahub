import { defaultPrimitives } from "@/lib/pdf-themes/primitives";
import type { PdfcnTheme } from "@/types/pdf-themes";

/**
 * pdfcn theme with the AncoraHub tokens (docs/design-system.md): Inter only,
 * hairline #e5e5e5 borders, near-black text and Electric Blue for highlights
 * and metrics — never as a large surface.
 */
export const ancoraPdfTheme: PdfcnTheme = {
  name: "ancorahub",
  primitives: {
    ...defaultPrimitives,
    borderRadius: { none: 0, sm: 6, md: 8, lg: 12, full: 9999 },
    typography: { xs: 7.5, sm: 8.5, base: 10, lg: 12, xl: 15, "2xl": 20, "3xl": 26 },
  },
  colors: {
    foreground: "#171717",
    background: "#ffffff",
    muted: "#f5f5f5",
    mutedForeground: "#737373",
    primary: "#0a0a0a",
    primaryForeground: "#ffffff",
    border: "#e5e5e5",
    accent: "#2563eb",
    destructive: "#991b1b",
    success: "#166534",
    warning: "#92400e",
    info: "#2563eb",
  },
  typography: {
    body: { fontFamily: "Inter", fontSize: 9, lineHeight: 1.45 },
    heading: {
      fontFamily: "Inter",
      fontWeight: 600,
      lineHeight: 1.2,
      fontSize: { h1: 24, h2: 15, h3: 12, h4: 10.5, h5: 9.5, h6: 8.5 },
    },
  },
  spacing: {
    page: { marginTop: 36, marginRight: 36, marginBottom: 36, marginLeft: 36 },
    sectionGap: 20,
    paragraphGap: 6,
    componentGap: 10,
  },
  page: { size: "A4", orientation: "portrait" },
};
