"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, CheckCircle2, RefreshCw, Layers, Sliders, Play, Info, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motionTokens, fade, fadeUp, scaleFade, slideInRight, staggerContainer, staggerItem } from "@/lib/motion";

export default function MotionPlaygroundPage() {
  const [activeTab, setActiveTab] = useState("presets");
  const [buttonState, setButtonState] = useState<"idle" | "loading" | "success">("idle");
  const [showCard, setShowCard] = useState(true);
  const [count, setCount] = useState(42);

  const tabs = [
    { id: "presets", label: "Presets & Animações" },
    { id: "interactive", label: "Componentes Interativos" },
    { id: "tokens", label: "Tokens & Tempos" },
  ];

  function handleSimulateAction() {
    setButtonState("loading");
    setTimeout(() => {
      setButtonState("success");
      setTimeout(() => setButtonState("idle"), 1200);
    }, 1000);
  }

  return (
    <div className="container max-w-5xl space-y-8 p-6 pb-16">
      <div className="space-y-2">
        <Badge variant="outline" className="gap-1 text-xs">
          <Sparkles className="size-3 text-primary" />
          Motion Design System
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight">Playground do Motion Design System</h1>
        <p className="text-sm text-muted-foreground">
          Biblioteca viva de microinterações, tokens de tempo, presets e respostas táteis do AncoraHub.
        </p>
      </div>

      {/* Sliding Tabs */}
      <div className="flex border-b border-border gap-1 relative">
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className="relative px-4 py-2 text-xs font-semibold transition-colors focus:outline-none"
            >
              {isActive && (
                <motion.div
                  layoutId="active-playground-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className={isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {activeTab === "presets" && (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Animações de Presets (`fadeUp`, `scaleFade`, `slideInRight`)</CardTitle>
              <CardDescription className="text-xs">
                Clique no botão para alternar visibilidade e observar a fluidez da montagem e desmontagem.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button size="sm" variant="outline" onClick={() => setShowCard(!showCard)}>
                <RefreshCw className="size-3.5 mr-1.5" />
                Alternar Visibilidade (AnimatePresence)
              </Button>

              <AnimatePresence mode="wait">
                {showCard && (
                  <motion.div
                    key="preset-card"
                    variants={scaleFade}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs text-primary">
                      <CheckCircle2 className="size-4" />
                      Componente Renderizado com `scaleFade`
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Transição suave de 140ms com curva de desceleração `smoothOut` [0.16, 1, 0.3, 1].
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stagger Container & Items</CardTitle>
              <CardDescription className="text-xs">
                Sequência encadeada de entrada para listas e grids com stagger de 40ms por item.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-2 sm:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    variants={staggerItem}
                    className="rounded-lg border p-3 bg-card space-y-1 text-xs"
                  >
                    <span className="font-bold text-foreground">Item #{i}</span>
                    <p className="text-muted-foreground text-[11px]">Entrada encadeada individual.</p>
                  </motion.div>
                ))}
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {activeTab === "interactive" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Respostas Táteis dos Botões (`active:scale-[0.97]`)</CardTitle>
              <CardDescription className="text-xs">
                Pressione os botões abaixo para sentir o feedback instantâneo de toque sem desalinhamento de layout.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button onClick={handleSimulateAction} disabled={buttonState === "loading"}>
                {buttonState === "loading" ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin mr-1.5" />
                    Salvando...
                  </>
                ) : buttonState === "success" ? (
                  <>
                    <Check className="size-3.5 text-emerald-400 mr-1.5" />
                    Salvo com Sucesso!
                  </>
                ) : (
                  "Simular Ação com Feedback"
                )}
              </Button>

              <Button variant="secondary" size="sm">
                Botão Secundário
              </Button>
              <Button variant="outline" size="sm">
                Botão Outline
              </Button>
              <Button variant="destructive" size="sm">
                Destrutivo
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Animação de Contador de Estatísticas</CardTitle>
              <CardDescription className="text-xs">
                Mudança numérica com micro-transição sem contagem do zero.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4">
                <span className="text-3xl font-extrabold text-foreground">{count}</span>
                <Button size="sm" variant="outline" onClick={() => setCount(count + 1)}>
                  + Incrementar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "tokens" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tokens do Sistema</CardTitle>
            <CardDescription className="text-xs">
              Valores centrais exportados em `@/lib/motion/motion-tokens`.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs font-mono">
            <div className="rounded-lg border p-4 bg-muted/40 space-y-2">
              <div className="font-bold text-foreground">Durações (Segundos):</div>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>instant: {motionTokens.duration.instant}s</li>
                <li>fast: {motionTokens.duration.fast}s</li>
                <li>normal: {motionTokens.duration.normal}s</li>
                <li>deliberate: {motionTokens.duration.deliberate}s</li>
                <li>slow: {motionTokens.duration.slow}s</li>
              </ul>
            </div>

            <div className="rounded-lg border p-4 bg-muted/40 space-y-2">
              <div className="font-bold text-foreground">Escalas (Scale):</div>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>press: {motionTokens.scale.press}</li>
                <li>subtle: {motionTokens.scale.subtle}</li>
                <li>enter: {motionTokens.scale.enter}</li>
                <li>hover: {motionTokens.scale.hover}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
