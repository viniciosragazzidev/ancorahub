import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { Plus_Jakarta_Sans, Geist_Mono, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppProviders } from "@/components/app-providers";
import Script from "next/script";
import { SplashScreen } from "@/components/splash-screen";
import { SPLASH_BOOT_SCRIPT } from "@/components/splash-boot";
import { InterfaceMotionProvider } from "@/components/motion/interface-motion-provider";
import { RouteViewTransition } from "@/components/motion/route-view-transition";
import { SkipToContent } from "@/components/skip-to-content";
import { shouldUseDirectorLiteStyle } from "@/features/director-lite/style-flag";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { isDirectorF2DevPreview } from "@/components/light/director-f2-dev-preview";
import { isDirectorShellRealDevPreview } from "@/components/light/director-shell-real-dev-preview";
import { isNegotiationsDevPreview } from "@/components/light/negotiations-dev-preview";
import "./globals.css";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta-sans",
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

/** Telas de iPhone em retrato: largura e altura em pontos e a densidade. Imagens em public/splash/ios. */
const IOS_SCREENS: Array<[number, number, number]> = [
  [440, 956, 3], [430, 932, 3], [402, 874, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3],
  [375, 812, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2],
];
const IOS_STARTUP_IMAGES = IOS_SCREENS.map(([width, height, ratio]) => ({
  url: `/splash/ios/splash-${width * ratio}x${height * ratio}.jpg`,
  media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`,
}));

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
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icon.png",
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
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
    // Abertura do PWA no iPhone: a mesma arte da splash (capitão e ÂNCORA sobre #002B73), uma por tela.
    startupImage: IOS_STARTUP_IMAGES,
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const requestPath = process.env.NODE_ENV === "development" ? (await headers()).get("x-pathname") ?? "" : "";
  const isDirectorDevPreview = isDirectorF2DevPreview(requestPath) || isDirectorShellRealDevPreview(requestPath) || isNegotiationsDevPreview(requestPath);
  let directorLiteEnabled = false;

  if (!isDirectorDevPreview) {
    try {
      const context = await getRequiredTenantContext();
      directorLiteEnabled = await shouldUseDirectorLiteStyle(context);
    } catch {
      directorLiteEnabled = false;
    }
  }

  const theme = !directorLiteEnabled && cookieStore.get("corretop-theme")?.value === "dark" ? "dark" : "light";

  return (
    <html lang="pt-BR" data-interface-motion="off" suppressHydrationWarning className={`${jakartaSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} ${theme === "dark" ? "dark" : ""} h-full antialiased`}>
      <head>
        <Script id="ancora-splash-boot" strategy="beforeInteractive">{SPLASH_BOOT_SCRIPT}</Script>
      </head>
      <body className="min-h-full flex flex-col">
        <SkipToContent />
        <SplashScreen />
        <InterfaceMotionProvider enabled={isDirectorDevPreview ? false : undefined}>
          <AppProviders forceLightTheme={directorLiteEnabled} directorLiteEnabled={directorLiteEnabled}>
            <TooltipProvider><div id="main-content" tabIndex={-1}><RouteViewTransition>{children}</RouteViewTransition></div></TooltipProvider>
            <Toaster directorLiteEnabled={directorLiteEnabled} />
          </AppProviders>
        </InterfaceMotionProvider>
      </body>
    </html>
  );
}
