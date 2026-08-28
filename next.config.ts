import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "imgur.com",
      },
      {
        protocol: "https",
        hostname: "i.imgur.com",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/minha-fila", destination: "/leads?tab=minha-fila", permanent: false },
      { source: "/propostas", destination: "/vendas?tab=propostas", permanent: false },
      { source: "/unidades", destination: "/filiais", permanent: false },
      { source: "/materiais-divulgacao", destination: "/marketing?tab=materiais", permanent: false },
      { source: "/configuracoes/comissoes", destination: "/settings?tab=comissoes", permanent: false },
      { source: "/financeiro", destination: "/distribuicao?view=resumo_dia", permanent: false },
      { source: "/cotacao", destination: "/leads", permanent: false },
      { source: "/catalogo", destination: "/conversas", permanent: false },
      { source: "/inteligencia", destination: "/qualificacao", permanent: false },
      { source: "/agentes-ia", destination: "/qualificacao", permanent: false },
      { source: "/corretor/resumo", destination: "/distribuicao?view=resumo_dia", permanent: false },
      { source: "/gestor", destination: "/distribuicao?view=resumo_dia", permanent: false },
      { source: "/diretor/resume", destination: "/distribuicao?view=resumo_dia", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
