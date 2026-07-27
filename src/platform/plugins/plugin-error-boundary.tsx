"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type Props = { pluginId: string; children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean };

export class PluginErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true } satisfies State;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[plugin:${this.props.pluginId}] isolated render failure`, { error, info });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center"><p className="text-sm font-medium">Este painel não pôde ser carregado.</p><p className="text-xs text-muted-foreground">O restante do workspace continua disponível.</p><Button size="sm" variant="outline" onClick={() => this.setState({ hasError: false })}>Tentar novamente</Button></div>;
  }
}
