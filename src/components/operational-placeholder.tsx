"use client";

import { ArrowRight, CircleDashed } from "@/components/huge-icons";
import { motion } from "motion/react";

import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function OperationalPlaceholder({ breadcrumb, title, description }: { breadcrumb: string; title: string; description: string }) {
  return (
    <>
      <DashboardHeader breadcrumb={breadcrumb} title={title} />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
        >
          <p className="text-xs font-medium text-primary">EM PREPARAÇÃO</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        </motion.section>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0, 0, 0.2, 1], delay: 0.08 }}
        >
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Módulo preparado</CardTitle>
                  <CardDescription>A estrutura da rota já está disponível para receber o fluxo completo.</CardDescription>
                </div>
                <Badge variant="outline" className="gap-1.5">
                  <CircleDashed size={13} /> Planejado
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                <ArrowRight size={15} /> O próximo passo é conectar os dados e ações deste módulo ao domínio correspondente.
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </>
  );
}
