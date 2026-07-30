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
    title: "Ancora Corretora CRM",
  description: "CRM para corretoras de planos de saúde.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
  title: "Ancora Corretora CRM",
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
