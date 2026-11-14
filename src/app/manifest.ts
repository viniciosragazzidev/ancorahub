import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AncoraHub — Âncora Saúde",
    short_name: "AncoraHub",
    description: "Plataforma de Gestão de Leads e Qualificação IA da Âncora Saúde.",
    start_url: "/",
    display: "standalone",
    // Mesmo azul da splash: a tela do PWA instalado emenda com a splash sem piscar.
    background_color: "#002b73",
    theme_color: "#002b73",
    orientation: "portrait-primary",
    categories: ["business", "productivity"],
    lang: "pt-BR",
    dir: "ltr",
    prefer_related_applications: false,
    display_override: ["window-controls-overlay", "standalone"],
    scope: "/",
    id: "/",
    launch_handler: {
      client_mode: ["focus-existing", "navigate-new"],
    },
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/logo.webp",
        sizes: "512x512",
        type: "image/webp",
        form_factor: "wide",
        label: "Ancora Corretora CRM",
      },
      {
        src: "/logo.webp",
        sizes: "512x512",
        type: "image/webp",
        form_factor: "narrow",
        label: "Ancora Corretora CRM",
      },
    ],
    shortcuts: [
      {
        name: "Dashboard",
        short_name: "Início",
        description: "Ir para o dashboard",
        url: "/dashboard",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Conversas",
        short_name: "Chat",
        description: "Abrir central de mensagens",
        url: "/conversas",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Leads",
        short_name: "Leads",
        description: "Abrir fila de oportunidades",
        url: "/leads",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
