import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, Geist_Mono, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppProviders } from "@/components/app-providers";
import { SplashScreen } from "@/components/splash-screen";
import { InterfaceMotionProvider } from "@/components/motion/interface-motion-provider";
import { RouteViewTransition } from "@/components/motion/route-view-transition";
import { SkipToContent } from "@/components/skip-to-content";
import "./globals.css";

const interSans = Inter({
  variable: "--font-inter-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://crm.ancorasaude.cloud"),
  title: {
    default: "AncoraHub — Âncora Saúde",
    template: "%s | AncoraHub",
  },
  description:
    "Plataforma inteligente de gestão de leads, distribuição automática, qualificação com Inteligência Artificial via WhatsApp e gestão comercial da Âncora Saúde.",
  keywords: [
    "AncoraHub",
    "Âncora Saúde",
    "CRM Saúde",
    "Qualificação com IA",
    "WhatsApp CRM",
    "Gestão de Leads",
    "Corretor de Seguros",
  ],
  authors: [{ name: "Âncora Saúde", url: "https://crm.ancorasaude.cloud" }],
  creator: "Âncora Saúde",
  publisher: "Âncora Saúde",
  icons: {
    icon: [
      { url: "/icon.png", sizes: "32x32",  type: "image/png" },
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icon.png",
    apple: [{ url: "/icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "AncoraHub — Âncora Saúde",
    description:
      "Plataforma inteligente de gestão de leads, distribuição automática e qualificação por IA via WhatsApp.",
    url: "https://crm.ancorasaude.cloud",
    siteName: "AncoraHub",
    images: [
      {
        url: "/logo.webp",
        width: 1200,
        height: 630,
        alt: "AncoraHub — Âncora Saúde",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AncoraHub — Âncora Saúde",
    description:
      "Gestão de leads, qualificação via IA e distribuição inteligente para a Âncora Saúde.",
    images: ["/logo.webp"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AncoraHub",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-touch-startup-image": "/logo.webp",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = (await cookies()).get("ancora-theme")?.value === "dark" ? "dark" : "light";
  // Motion is enabled by default. The system setting check was removed from
  // the root layout because a database query here blocks ALL page rendering,
  // including the public landing page. If the database is slow or unreachable
  // the entire site would fail to load.
  // The setting can be evaluated client-side if stricter control is needed.
  const motionEnabled = true;

  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${interSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} ${theme === "dark" ? "dark" : ""} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <SkipToContent />
        <SplashScreen />
        <InterfaceMotionProvider enabled={motionEnabled}>
          <AppProviders>
            <TooltipProvider><div id="main-content" tabIndex={-1}><RouteViewTransition>{children}</RouteViewTransition></div></TooltipProvider>
            <Toaster />
          </AppProviders>
        </InterfaceMotionProvider>
      </body>
    </html>
  );
}
