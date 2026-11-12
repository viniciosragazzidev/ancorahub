import type { NextConfig } from "next";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // Next.js inline bootstrap scripts; the Meta SDK for WhatsApp Embedded Signup.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  // Supabase realtime/auth and the Meta Graph calls made by the SDK.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://graph.facebook.com https://*.facebook.com",
  "frame-src 'self' https://www.facebook.com https://web.facebook.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  // Docker build on the VPS (Dockerfile sets both): types are checked before every push (tsc),
  // so the build skips that pass, and Turbopack keeps its cache between deploys (20/10: 11 min builds).
  typescript: { ignoreBuildErrors: process.env.SKIP_BUILD_TYPECHECK === "1" },
  experimental: { turbopackFileSystemCacheForBuild: process.env.NEXT_BUILD_FS_CACHE === "1" },
  // takumi-pdf loads its WebAssembly from its own folder: keep it out of the bundle.
  serverExternalPackages: ["takumi-pdf"],
  // The lead quality PDF reads its Inter fonts at runtime.
  outputFileTracingIncludes: {
    "/api/reports/lead-quality": ["./src/features/reports/pdf/fonts/**/*"],
  },
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
          // The CRM is HTTPS only: browsers never try plain HTTP again for a year.
          // No includeSubDomains/preload until every *.ancorasaude.cloud host is HTTPS.
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000",
          },
          // Report-Only first: the browser only logs what this policy would block,
          // nothing stops working. Enforce it once the console shows no violation
          // on the real screens (security plan, lote 5).
          {
            key: "Content-Security-Policy-Report-Only",
            value: CONTENT_SECURITY_POLICY,
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
