"use client";

import { CorreTopLogo } from "@/components/corretop-logo";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import {
  ArrowRight,
  Buildings,
  ChartLineUp,
  Handshake,
  Phone,
  RocketLaunch,
  ShieldCheck,
  Target,
  Users,
  UsersThree,
  WhatsappLogo,
} from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Section Wrapper ────────────────────────────────────────────────────────

function Section({
  children,
  className,
  id,
  dark,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  dark?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative px-4 py-20 md:px-6 md:py-28 lg:py-32",
        dark
          ? "bg-[#111] text-[#f5f5f5] dark"
          : "bg-background text-foreground",
        className,
      )}
    >
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "mb-3 block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

function SectionHeader({
  label,
  title,
  description,
  className,
}: {
  label?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-14 max-w-2xl", className)}>
      {label && <SectionLabel>{label}</SectionLabel>}
      <h2 className="text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-muted-foreground md:text-lg">
          {description}
        </p>
      )}
    </div>
  );
}

// ─── Navigation ─────────────────────────────────────────────────────────────

function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-border/50 bg-background/80 shadow-[0_1px_0_rgba(0,0,0,0.02)] backdrop-blur-lg"
          : "bg-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <Link
          className="flex items-center gap-2 text-sm font-semibold tracking-tight"
          href="/"
        >
          <CorreTopLogo className="h-8 w-32 object-contain object-left" />
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <NavLink href="#recursos">Recursos</NavLink>
          <NavLink href="#como-funciona">Como funciona</NavLink>
          <NavLink href="#depoimentos">Depoimentos</NavLink>
          <Link
            href="/login"
            className="rounded-lg px-4 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
          >
            Entrar
          </Link>
          <Button size="sm" render={<Link href="/login" />}>
            Começar <ArrowRight className="ml-1 size-3.5" />
          </Button>
        </div>

        {/* Mobile menu trigger */}
        <div className="flex items-center gap-3 md:hidden">
          <Link
            href="/login"
            className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
          >
            Entrar
          </Link>
          <Button size="sm" render={<Link href="/login" />}>Começar</Button>
        </div>
      </nav>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
    >
      {children}
    </Link>
  );
}

// ─── Hero ───────────────────────────────────────────────────────────────────

function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative min-h-[100dvh] overflow-hidden pt-24">
      {/* Background pattern */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[length:64px_64px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_30%,black_20%,transparent_70%)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)]" />
        <div className="absolute left-1/2 top-0 -z-10 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-b from-foreground/[0.03] to-transparent dark:from-white/[0.04]" />
      </div>

      <div className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-7xl flex-col items-center justify-center px-4 md:px-6 lg:flex-row lg:gap-20">
        {/* Text side */}
        <motion.div
          className="max-w-2xl text-center lg:text-left"
          initial={reduce ? false : { opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <Badge variant="outline" className="mb-6 border-foreground/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            CRM para corretoras de saude
          </Badge>
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight md:text-5xl lg:text-6xl xl:text-7xl">
            A plataforma que sua
            <br />
            <span className="text-foreground/50">corretora merece.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg lg:mx-0">
            Gestao de leads, distribuicao inteligente, conversas via WhatsApp e
            controle operacional completo para corretoras de planos de saude.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Button size="lg" className="h-10 gap-2 px-5 text-sm" render={<Link href="/login" />}>
              Comecar gratis <ArrowRight className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-10 gap-2 px-5 text-sm"
              render={<Link href="#recursos" />}
            >
              Ver recursos <ChartLineUp className="size-4" />
            </Button>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Sem cartao de credito. Configuracao em minutos.
          </p>
        </motion.div>

        {/* Visual side - Abstract grid */}
        <motion.div
          className="mt-12 w-full max-w-lg lg:mt-0"
          initial={reduce ? false : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border bg-card shadow-[0_18px_50px_-32px_rgba(0,0,0,0.12)] dark:shadow-[0_18px_50px_-32px_rgba(0,0,0,0.4)]">
            {/* Abstract data visualization */}
            <div className="absolute inset-0 grid grid-cols-3 gap-3 p-5">
              <div className="col-span-2 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-success" />
                  <span className="text-[11px] font-medium text-foreground/70">Leads ativos</span>
                  <span className="ml-auto text-sm font-semibold tabular-nums">247</span>
                </div>
                <div className="h-24 rounded-lg border border-border/50 bg-muted/30 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <ChartLineUp className="size-3 text-muted-foreground" />
                    <span className="text-[10px] font-medium text-muted-foreground">Conversao este mes</span>
                    <span className="ml-auto text-xs font-semibold tabular-nums text-success">+23,4%</span>
                  </div>
                  <div className="flex h-10 items-end gap-1">
                    {[32, 45, 28, 52, 38, 61, 44, 55, 39, 48, 52, 58].map((h, i) => (
                      <div
                        key={i}
                        className="w-full rounded-t bg-foreground/20 transition-all duration-500"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-md border border-border/50 bg-muted/30 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                    WhatsApp conectado
                  </span>
                  <span className="rounded-md border border-border/50 bg-muted/30 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                    12 corretores
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-accent" />
                  <span className="text-[11px] font-medium text-foreground/70">Fila</span>
                  <span className="ml-auto text-sm font-semibold tabular-nums">18</span>
                </div>
                <div className="space-y-2 rounded-lg border border-border/50 bg-muted/30 p-3">
                  {[
                    { name: "Ana S.", status: "success" as const, time: "2 min" },
                    { name: "Carlos M.", status: "warning" as const, time: "15 min" },
                    { name: "Juliana R.", status: "default" as const, time: "1 h" },
                  ].map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          item.status === "success"
                            ? "bg-success"
                            : item.status === "warning"
                              ? "bg-accent"
                              : "bg-muted-foreground",
                        )}
                      />
                      <span className="text-[10px] font-medium text-foreground/60">{item.name}</span>
                      <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">{item.time}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                  <p className="text-[10px] font-medium text-muted-foreground">Distribuicao</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-[73%] rounded-full bg-foreground/30 transition-all" />
                    </div>
                    <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">73%</span>
                  </div>
                </div>
              </div>
            </div>
            {/* Glass overlay */}
            <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-card to-transparent" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Stats Bar ──────────────────────────────────────────────────────────────

function StatsBar() {
  const reduce = useReducedMotion();
  const stats = [
    { value: "15k+", label: "Leads gerenciados" },
    { value: "98%", label: "Uptime" },
    { value: "3min", label: "Tempo medio de atribuicao" },
    { value: "12+", label: "Operadoras integradas" },
  ];

  return (
    <div className="border-y border-border bg-muted/30">
      <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-border md:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="flex flex-col items-center justify-center px-4 py-10 text-center md:py-14"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
          >
            <span className="text-3xl font-semibold tracking-tight md:text-4xl">
              {stat.value}
            </span>
            <span className="mt-1 text-xs text-muted-foreground md:text-sm">
              {stat.label}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Features (Bento Grid) ──────────────────────────────────────────────────

const features = [
  {
    icon: WhatsappLogo,
    title: "WhatsApp integrado",
    description:
      "Central de conversas com historico completo. Envie mensagens, compartilhe documentos e mantenha todo o atendimento registrado.",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    span: "col-span-1 md:col-span-2",
  },
  {
    icon: Users,
    title: "Distribuicao inteligente",
    description:
      "Leads sao atribuidos automaticamente ao corretor disponivel. Regras de plantao, filas e pausas configuradas por filial.",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    span: "col-span-1",
  },
  {
    icon: ChartLineUp,
    title: "Funil comercial",
    description:
      "Acompanhe cada etapa: novo, em contato, cotacao, convertido. Visibilidade completa do pipeline.",
    color: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    span: "col-span-1",
  },
  {
    icon: Buildings,
    title: "Multi-filial",
    description:
      "Estrutura organizacional completa com filiais, gestores, diretores e corretores. Cada unidade com suas regras e metas.",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    span: "col-span-1",
  },
  {
    icon: ShieldCheck,
    title: "Controle de acesso",
    description:
      "Permissoes granulares por papel: Diretor, Gestor e Corretor. Cada nivel enxerga exatamente o que precisa.",
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    span: "col-span-1 md:col-span-2",
  },
  {
    icon: Handshake,
    title: "Catalogos de planos",
    description:
      "Cadastro completo de operadoras e planos com precos por faixa etaria. Cote em segundos.",
    color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    span: "col-span-1 md:col-span-3",
  },
];

function FeaturesGrid() {
  const reduce = useReducedMotion();

  return (
    <Section id="recursos">
      <SectionHeader
        label="Recursos"
        title="Tudo que sua corretora precisa"
        description="Uma plataforma completa para gerenciar leads, conversas, equipe e resultados. Tudo em um so lugar."
      />

      <div className="grid gap-4 md:grid-cols-3 md:grid-rows-[auto_auto_auto]">
        {features.map((feature, i) => (
          <motion.div
            key={feature.title}
            className={cn(
              "group relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all duration-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)]",
              feature.span,
            )}
            initial={reduce ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
          >
            <div
              className={cn(
                "mb-4 grid size-10 place-items-center rounded-lg",
                feature.color,
              )}
            >
              <feature.icon className="size-5" />
            </div>
            <h3 className="text-sm font-semibold tracking-tight">{feature.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

// ─── How It Works ───────────────────────────────────────────────────────────

const steps = [
  {
    number: "01",
    icon: WhatsappLogo,
    title: "Conecte o WhatsApp",
    description:
      "Vincule o numero da corretora em poucos cliques. Toda conversa com clientes fica centralizada no CorreTop.",
  },
  {
    number: "02",
    icon: UsersThree,
    title: "Configure sua equipe",
    description:
      "Adicione corretores, defina filiais e organize a distribuicao. Cada membro tem acesso ao seu escopo.",
  },
  {
    number: "03",
    icon: Target,
    title: "Acompanhe resultados",
    description:
      "Leads entram, sao distribuidos e acompanhados em tempo real. Metricas claras de conversao e desempenho.",
  },
];

function HowItWorks() {
  const reduce = useReducedMotion();

  return (
    <Section id="como-funciona" dark>
      <SectionHeader
        label="Como funciona"
        title="Comece em minutos"
        description="Tres passos simples para transformar a operacao da sua corretora."
        className="text-[#f5f5f5] [&_p]:text-[#a1a1aa]"
      />

      <div className="grid gap-8 md:grid-cols-3 md:gap-12">
        {steps.map((step, i) => (
          <motion.div
            key={step.number}
            className="relative"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.15 }}
          >
            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className="absolute left-6 top-12 hidden h-[calc(100%+1rem)] w-px bg-white/10 md:block" />
            )}
            <div className="grid size-12 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
              <step.icon className="size-5 text-[#a1a1aa]" />
            </div>
            <span className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#52525b]">
              Passo {step.number}
            </span>
            <h3 className="mt-2 text-lg font-semibold tracking-tight text-[#f5f5f5]">
              {step.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[#a1a1aa]">
              {step.description}
            </p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

// ─── Testimonials ───────────────────────────────────────────────────────────

const testimonials = [
  {
    quote:
      "O CorreTop transformou nossa operacao. Consegui organizar a equipe de 8 corretores e o acompanhamento de leads ficou muito mais eficiente.",
    author: "Ricardo Mendes",
    role: "Diretor Comercial",
    company: "Vertice Saude Corretora",
  },
  {
    quote:
      "A integracao com WhatsApp foi o que mais fez diferenca. Nao perco mais nenhum lead e todo historico fica salvo automaticamente.",
    author: "Camila Oliveira",
    role: "Gestora de Vendas",
    company: "Plena Corretora",
  },
  {
    quote:
      "A distribuicao automatica de leads acabou com a briga por atendimento. Cada lead vai para o corretor certo na hora certa.",
    author: "Felipe Torres",
    role: "Corretor",
    company: "Premier Corretora",
  },
];

function Testimonials() {
  const reduce = useReducedMotion();

  return (
    <Section id="depoimentos">
      <SectionHeader
        label="Depoimentos"
        title="O que dizem nossos clientes"
        description="Corretoras de todo o Brasil confiam no CorreTop para gerenciar sua operacao."
      />

      <div className="grid gap-6 md:grid-cols-3">
        {testimonials.map((item, i) => (
          <motion.figure
            key={item.author}
            className="relative rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
          >
            <div className="mb-1 flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg
                  key={star}
                  aria-hidden="true"
                  className="size-4 fill-foreground/20"
                  viewBox="0 0 20 20"
                >
                  <path d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.33L10 13.18l-4.77 2.54.91-5.33L2.27 6.62l5.34-.78L10 1z" />
                </svg>
              ))}
            </div>
            <blockquote className="mt-3 text-sm leading-relaxed text-muted-foreground">
              &ldquo;{item.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-4 flex items-center gap-3 border-t border-border pt-4">
              <span className="grid size-8 place-items-center rounded-full bg-muted text-[11px] font-semibold">
                {item.author.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </span>
              <div>
                <span className="block text-xs font-semibold">{item.author}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {item.role}, {item.company}
                </span>
              </div>
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </Section>
  );
}

// ─── CTA ────────────────────────────────────────────────────────────────────

function CtaSection() {
  const reduce = useReducedMotion();

  return (
    <Section dark className="py-24 md:py-32">
      <motion.div
        className="mx-auto max-w-2xl text-center"
        initial={reduce ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
      >
        <SectionLabel className="text-[#52525b]">Comece agora</SectionLabel>
        <h2 className="text-3xl font-semibold tracking-tight text-[#f5f5f5] md:text-4xl lg:text-5xl">
          Pronto para transformar sua operacao?
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-[#a1a1aa]">
          Cadastre-se gratuitamente e descubra como o CorreTop pode ajudar sua
          corretora a vender mais e melhor.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button
            size="lg"
            className="h-10 gap-2 border-0 bg-[#f5f5f5] px-5 text-sm text-[#111] hover:bg-[#e5e5e5]"
            render={<Link href="/login" />}
          >
            Criar conta gratuita <RocketLaunch className="size-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-10 gap-2 border-white/10 px-5 text-sm text-[#a1a1aa] hover:bg-white/[0.04] hover:text-[#f5f5f5]"
            render={<Link href="#recursos" />}
          >
            Falar com vendas <Phone className="size-4" />
          </Button>
        </div>
      </motion.div>
    </Section>
  );
}

// ─── Footer ─────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link className="flex items-center gap-2 text-sm font-semibold tracking-tight" href="/">
              <CorreTopLogo className="h-8 w-32 object-contain object-left" />
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              CRM operacional para corretoras de planos de saude. Gestao de leads,
              distribuicao inteligente e central de atendimento.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Produto
            </h4>
            <ul className="space-y-2">
              {["Recursos", "Precos", "Integracoes", "Roadmap"].map((item) => (
                <li key={item}>
                  <Link
                    href="#"
                    className="text-sm text-foreground/70 transition-colors hover:text-foreground"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Empresa
            </h4>
            <ul className="space-y-2">
              {[
                { label: "Sobre", href: "#" },
                { label: "Blog", href: "#" },
                { label: "Contato", href: "#" },
                { label: "Termos e privacidade", href: "/termos" },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-foreground/70 transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-6 text-center text-xs text-muted-foreground md:text-left">
          <p>&copy; {new Date().getFullYear()} CorreTop. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      <Nav />
      <Hero />
      <StatsBar />
      <FeaturesGrid />
      <HowItWorks />
      <Testimonials />
      <CtaSection />
      <Footer />
    </>
  );
}
