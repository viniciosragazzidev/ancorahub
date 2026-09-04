"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "@/components/ui/sonner";
import {
  ArrowsClockwise,
  Brain,
  CheckCircle,
  Clock,
  CursorClick,
  Funnel,
  Hand,
  LinkSimple,
  MagnifyingGlass,
  Minus,
  Play,
  Plus,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
  createWorkflowDraftAction,
  publishWorkflowAction,
  saveWorkflowDraftAction,
} from "../actions";
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowNodeCategory,
  WorkflowNodeKind,
  WorkflowValidationIssue,
} from "../contracts";
import {
  autoLayoutWorkflow,
  canConnectWorkflowNodes,
  connectWorkflowNodes,
  createWorkflowNode,
  removeWorkflowNode,
} from "../editor-state";
import { workflowDefinitionSchema } from "../input";
import { getWorkflowNodeDefinition, listWorkflowNodeDefinitions } from "../registry";
import { validateWorkflowDefinition } from "../validation";

type StoredWorkflow = {
  id: string;
  name: string;
  description: string | null;
  draftDefinition: unknown;
  status: string;
};
type SaveState = "local" | "saving" | "saved" | "error";
type CanvasMode = "move" | "node" | "connect";

const categoryLabel: Record<WorkflowNodeCategory, string> = {
  trigger: "Gatilhos",
  logic: "Lógica",
  control: "Tempo",
  crm: "CRM",
  ai: "IA",
  channel: "Canais",
};
const categoryIcon: Record<WorkflowNodeCategory, React.ComponentType<{ className?: string }>> = {
  trigger: Play,
  logic: Funnel,
  control: Clock,
  crm: CheckCircle,
  ai: Brain,
  channel: LinkSimple,
};

function nodeGuide(kind: WorkflowNodeKind) {
  if (kind === "ai.classify_lead")
    return {
      how: "Recebe os dados autorizados do lead e pede à IA uma classificação estruturada conforme a instrução que você escrever.",
      example:
        "Exemplo de instrução: classifique o interesse como quente, morno ou frio e justifique em uma frase.",
      limit:
        "Ela não altera o status, responsável ou dados do lead. A saída é apenas uma proposta e depende da IA estar liberada pela plataforma.",
    };
  if (kind === "channel.whatsapp_send")
    return {
      how: "Prepara uma comunicação pelo canal oficial para um lead que chegou até este ponto do fluxo.",
      example: "Exemplo: enviar o template aprovado de confirmação de atendimento.",
      limit:
        "O envio depende de consentimento, janela válida, template aprovado e confirmação humana quando exigida.",
    };
  if (kind === "logic.condition")
    return {
      how: "Compara uma regra que você definir e divide a automação entre os caminhos Sim e Não.",
      example: "Exemplo: lead.classificação é quente.",
      limit: "Os dois caminhos precisam terminar em uma próxima etapa válida antes da publicação.",
    };
  if (kind === "control.delay")
    return {
      how: "Mantém esta execução aguardando pelo período informado antes de seguir para a próxima etapa.",
      example: "Exemplo: aguardar 30 minutos antes de criar uma tarefa de retorno.",
      limit: "O período deve ser explícito; este nó não envia mensagens nem muda dados por si só.",
    };
  if (kind === "crm.create_task")
    return {
      how: "Cria uma tarefa auditável para a equipe acompanhar o lead no CRM.",
      example: "Exemplo: ligar para o lead em 30 minutos.",
      limit:
        "Defina ao menos o título. A responsabilidade continua sujeita às permissões e ao escopo da equipe.",
    };
  if (kind === "crm.add_tag")
    return {
      how: "Adiciona uma etiqueta permitida ao lead para facilitar segmentação e trabalho posterior.",
      example: "Exemplo: interesse-alto.",
      limit: "Não muda etapa comercial, responsável ou dados pessoais.",
    };
  if (kind === "crm.notify_manager")
    return {
      how: "Gera um alerta interno para quem acompanha a operação, sem enviar uma comunicação externa.",
      example: "Exemplo: lead prioritário aguardando retorno.",
      limit:
        "Use uma mensagem objetiva; o alerta respeita a visibilidade operacional do destinatário.",
    };
  if (kind === "trigger.lead_created")
    return {
      how: "Abre uma nova execução sempre que um lead autorizado entra no CRM.",
      example: "Exemplo: iniciar triagem para leads recebidos por landing page.",
      limit: "É o começo do fluxo e não recebe uma etapa anterior.",
    };
  if (kind === "trigger.lead_updated")
    return {
      how: "Abre uma execução depois de uma atualização permitida no lead.",
      example: "Exemplo: reagir quando a origem ou uma informação de cadastro for atualizada.",
      limit: "Use o filtro de campos para evitar executar a automação em alterações irrelevantes.",
    };
  if (kind === "trigger.manual")
    return {
      how: "Inicia o fluxo apenas quando uma pessoa autorizada executa um teste ou comando manual.",
      example: "Exemplo: testar uma sequência antes de publicá-la.",
      limit: "Não acompanha automaticamente novos leads ou alterações do CRM.",
    };
  return {
    how: "Encaminha o fluxo conforme o valor configurado.",
    example: "Exemplo: escolher um caminho para cada origem de lead.",
    limit: "Revise as conexões antes de publicar para não deixar uma etapa sem continuidade.",
  };
}

function HelpTip({ children, content }: { children: React.ReactElement; content: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent className="max-w-72 whitespace-normal leading-5">{content}</TooltipContent>
    </Tooltip>
  );
}

function initialDefinition(): WorkflowDefinition {
  return {
    schemaVersion: 1,
    nodes: [
      { id: "start", kind: "trigger.lead_created", position: { x: 360, y: 110 }, config: {} },
    ],
    edges: [],
  };
}

function readDefinition(value: unknown) {
  const parsed = workflowDefinitionSchema.safeParse(value);
  return parsed.success ? parsed.data : initialDefinition();
}

function nodeTone(category: WorkflowNodeCategory) {
  return {
    trigger: "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    logic: "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    control: "border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    crm: "border-primary/35 bg-primary/10 text-primary",
    ai: "border-violet-500/35 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    channel: "border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  }[category];
}

export function WorkflowAutomationStudio({
  initialWorkflows,
}: {
  initialWorkflows: StoredWorkflow[];
}) {
  const reducedMotion = useReducedMotion();
  const [workflowId, setWorkflowId] = React.useState<string | null>(
    initialWorkflows[0]?.id ?? null,
  );
  const [name, setName] = React.useState(initialWorkflows[0]?.name ?? "Nova automação");
  const [description, setDescription] = React.useState(
    initialWorkflows[0]?.description ?? "Construa a sequência que a equipe precisa acompanhar.",
  );
  const [definition, setDefinition] = React.useState<WorkflowDefinition>(() =>
    initialWorkflows[0] ? readDefinition(initialWorkflows[0].draftDefinition) : initialDefinition(),
  );
  const [selectedNodeId, setSelectedNodeId] = React.useState<string>(definition.nodes[0]?.id ?? "");
  const [pendingSource, setPendingSource] = React.useState<{
    nodeId: string;
    handle: string;
  } | null>(null);
  const [quickAddSource, setQuickAddSource] = React.useState<{
    nodeId: string;
    handle: string;
  } | null>(null);
  const [query, setQuery] = React.useState("");
  const [saveState, setSaveState] = React.useState<SaveState>(workflowId ? "saved" : "local");
  const [dirty, setDirty] = React.useState(false);
  const [history, setHistory] = React.useState<WorkflowDefinition[]>([]);
  const [redo, setRedo] = React.useState<WorkflowDefinition[]>([]);
  const [canvasMode, setCanvasMode] = React.useState<CanvasMode>("node");
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLElement>(null);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState<{ x: number; y: number }>({ x: 60, y: 40 });
  const [isPanning, setIsPanning] = React.useState(false);
  const dragRef = React.useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const panStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const selectedNode = definition.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const issues = React.useMemo(() => validateWorkflowDefinition(definition), [definition]);

  const zoomIn = React.useCallback(() => {
    setZoom((current) => Math.min(2.5, Math.round((current + 0.15) * 100) / 100));
  }, []);

  const zoomOut = React.useCallback(() => {
    setZoom((current) => Math.max(0.25, Math.round((current - 0.15) * 100) / 100));
  }, []);

  const resetZoomPan = React.useCallback(() => {
    setZoom(1);
    setPan({ x: 60, y: 40 });
  }, []);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();

      if (event.ctrlKey || event.metaKey) {
        const zoomFactor = event.deltaY < 0 ? 1.12 : 0.88;
        setZoom((prevZoom) => {
          const nextZoom = Math.min(2.5, Math.max(0.25, prevZoom * zoomFactor));
          const mouseX = event.clientX - rect.left;
          const mouseY = event.clientY - rect.top;
          setPan((prevPan) => ({
            x: Math.round(mouseX - (mouseX - prevPan.x) * (nextZoom / prevZoom)),
            y: Math.round(mouseY - (mouseY - prevPan.y) * (nextZoom / prevZoom)),
          }));
          return nextZoom;
        });
      } else {
        setPan((prev) => ({
          x: Math.round(prev.x - event.deltaX),
          y: Math.round(prev.y - event.deltaY),
        }));
      }
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const updateDefinition = React.useCallback(
    (next: WorkflowDefinition) => {
      setHistory((current) => [...current.slice(-29), definition]);
      setRedo([]);
      setDefinition(next);
      setDirty(true);
      setSaveState("local");
    },
    [definition],
  );

  const persist = React.useCallback(
    async (showToast = false): Promise<string | null> => {
      setSaveState("saving");
      const input = { name, description: description || null, definition };
      const result = workflowId
        ? await saveWorkflowDraftAction(workflowId, input)
        : await createWorkflowDraftAction(input);
      if (!result.success) {
        setSaveState("error");
        if (showToast) toast.error("Não foi possível salvar o rascunho.");
        return null;
      }
      const createdId = "id" in result && typeof result.id === "string" ? result.id : null;
      if (createdId) setWorkflowId(createdId);
      setDirty(false);
      setSaveState("saved");
      if (showToast) toast.success("Rascunho salvo.");
      return createdId ?? workflowId;
    },
    [definition, description, name, workflowId],
  );

  React.useEffect(() => {
    if (!workflowId || !dirty || saveState === "saving") return;
    const timeout = window.setTimeout(() => {
      void persist(false);
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [dirty, persist, saveState, workflowId]);

  const addNode = (kind: WorkflowNodeKind, source = quickAddSource) => {
    const sourceNode = source
      ? definition.nodes.find((node) => node.id === source.nodeId)
      : selectedNode;
    const position = sourceNode
      ? { x: sourceNode.position.x + 290, y: sourceNode.position.y }
      : { x: Math.round((-pan.x + 240) / zoom), y: Math.round((-pan.y + 160 + definition.nodes.length * 36) / zoom) };
    const node = createWorkflowNode(kind, position);
    let next = { ...definition, nodes: [...definition.nodes, node] };
    if (source && canConnectWorkflowNodes(next, source.nodeId, node.id, source.handle))
      next = connectWorkflowNodes(next, source.nodeId, node.id, source.handle);
    updateDefinition(next);
    setSelectedNodeId(node.id);
    setQuickAddSource(null);
    setPendingSource(null);
  };

  const connectToNode = (target: WorkflowNode) => {
    if (!pendingSource || pendingSource.nodeId === target.id) return;
    const next = connectWorkflowNodes(
      definition,
      pendingSource.nodeId,
      target.id,
      pendingSource.handle,
    );
    if (next === definition) {
      toast.error("Essa conexão não é compatível ou a saída já está ocupada.");
      return;
    }
    updateDefinition(next);
    setPendingSource(null);
    toast.success("Conexão criada.");
  };

  const onNodePointerDown = (event: React.PointerEvent<HTMLDivElement>, node: WorkflowNode) => {
    if ((event.target as HTMLElement).closest("button,input,textarea")) return;
    if (canvasMode === "move") return;
    if (canvasMode === "connect" && !pendingSource) {
      const output = getWorkflowNodeDefinition(node.kind)?.ports.find(
        (port) => port.direction === "output",
      );
      if (output) {
        setPendingSource({ nodeId: node.id, handle: output.id });
        toast.info("Saída selecionada. Escolha a próxima etapa.");
      }
      return;
    }
    if (pendingSource) {
      connectToNode(node);
      return;
    }
    setSelectedNodeId(node.id);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseCanvasX = (event.clientX - rect.left) / zoom;
    const mouseCanvasY = (event.clientY - rect.top) / zoom;
    dragRef.current = {
      nodeId: node.id,
      offsetX: mouseCanvasX - node.position.x,
      offsetY: mouseCanvasY - node.position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning && panStartRef.current) {
      setPan({
        x: event.clientX - panStartRef.current.x,
        y: event.clientY - panStartRef.current.y,
      });
      return;
    }
    const drag = dragRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!drag || !rect) return;
    const mouseCanvasX = (event.clientX - rect.left) / zoom;
    const mouseCanvasY = (event.clientY - rect.top) / zoom;
    setDefinition((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === drag.nodeId
          ? {
              ...node,
              position: {
                x: Math.max(16, Math.round(mouseCanvasX - drag.offsetX)),
                y: Math.max(16, Math.round(mouseCanvasY - drag.offsetY)),
              },
            }
          : node,
      ),
    }));
    setDirty(true);
    setSaveState("local");
  };

  const onCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const isBgClick = event.target === event.currentTarget || (event.target as HTMLElement).dataset?.canvasBg === "true";
    if (canvasMode === "move" || event.button === 1 || isBgClick) {
      setIsPanning(true);
      panStartRef.current = {
        x: event.clientX - pan.x,
        y: event.clientY - pan.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const onCanvasPointerUp = () => {
    setIsPanning(false);
    dragRef.current = null;
    panStartRef.current = null;
  };
  const changeCanvasMode = (mode: CanvasMode) => {
    setCanvasMode(mode);
    setQuickAddSource(null);
    if (mode !== "connect") setPendingSource(null);
  };
  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setRedo((current) => [definition, ...current]);
    setHistory((current) => current.slice(0, -1));
    setDefinition(previous);
    setDirty(true);
  };
  const redoChange = () => {
    const next = redo[0];
    if (!next) return;
    setHistory((current) => [...current, definition]);
    setRedo((current) => current.slice(1));
    setDefinition(next);
    setDirty(true);
  };
  const publish = async () => {
    const id = await persist(true);
    if (!id) return;
    const result = await publishWorkflowAction(id);
    if (result.success) toast.success("Versão publicada com segurança.");
    else toast.error("Revise os problemas antes de publicar.");
  };

  const visibleDefinitions = listWorkflowNodeDefinitions().filter((item) =>
    `${item.label} ${item.description} ${item.category}`
      .toLocaleLowerCase("pt-BR")
      .includes(query.toLocaleLowerCase("pt-BR")),
  );

  return (
    <div className="flex flex-1 w-full h-full min-h-0 flex-col overflow-hidden bg-card">
      <header className="flex shrink-0 flex-col gap-4 border-b border-border/80 bg-card px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setDirty(true);
                setSaveState("local");
              }}
              aria-label="Nome da automação"
              className="h-9 max-w-xs border-transparent bg-transparent px-0 text-lg font-semibold shadow-none hover:border-input focus-visible:border-input"
            />
            <Badge variant="outline">Rascunho</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {saveState === "saving"
              ? "Salvando alterações…"
              : saveState === "saved"
                ? "Tudo salvo"
                : saveState === "error"
                  ? "Falha ao salvar — suas alterações continuam aqui"
                  : "Alterações locais não salvas"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            aria-label="Modo do cursor"
            className="inline-flex items-center rounded-lg border border-border/80 bg-muted/40 p-1 gap-1"
          >
            <HelpTip content="Mover: arraste uma área vazia para navegar pelo canvas sem alterar os nós.">
              <Button
                aria-label="Modo Mover"
                aria-pressed={canvasMode === "move"}
                size="icon"
                className="size-7"
                variant={canvasMode === "move" ? "secondary" : "ghost"}
                onClick={() => changeCanvasMode("move")}
              >
                <Hand className="size-4" />
              </Button>
            </HelpTip>

            <HelpTip content="Nós: selecione uma etapa e arraste-a para reorganizar o fluxo.">
              <Button
                aria-label="Modo Nós"
                aria-pressed={canvasMode === "node"}
                size="icon"
                className="size-7"
                variant={canvasMode === "node" ? "secondary" : "ghost"}
                onClick={() => changeCanvasMode("node")}
              >
                <CursorClick className="size-4" />
              </Button>
            </HelpTip>

            <HelpTip content="Conectar: escolha um nó de origem e depois a próxima etapa compatível.">
              <Button
                aria-label="Modo Conectar"
                aria-pressed={canvasMode === "connect"}
                size="icon"
                className="size-7"
                variant={canvasMode === "connect" ? "secondary" : "ghost"}
                onClick={() => changeCanvasMode("connect")}
              >
                <LinkSimple className="size-4" />
              </Button>
            </HelpTip>
          </div>
          <Button variant="outline" size="sm" onClick={undo} disabled={!history.length}>
            Desfazer
          </Button>
          <Button variant="outline" size="sm" onClick={redoChange} disabled={!redo.length}>
            Refazer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateDefinition(autoLayoutWorkflow(definition))}
          >
            <ArrowsClockwise className="size-4" />
            Organizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => void persist(true)}>
            Salvar
          </Button>
          <Button size="sm" onClick={() => void publish()} disabled={issues.length > 0}>
            <Play className="size-4" />
            Publicar
          </Button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[17rem_minmax(0,1fr)_19rem]">
        <aside className="hidden min-h-0 overflow-hidden border-r border-border/80 bg-muted/20 lg:flex lg:flex-col">
          <div className="shrink-0 border-b border-border/70 p-3">
            <div className="relative">
              <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar elementos"
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1" orientation="vertical">
            <div className="space-y-5 p-3 pb-6">
              {(
                ["trigger", "logic", "crm", "control", "ai", "channel"] as WorkflowNodeCategory[]
              ).map((category) => {
                const Icon = categoryIcon[category];
                const items = visibleDefinitions.filter((item) => item.category === category);
                if (!items.length) return null;
                return (
                  <section key={category}>
                    <p className="mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      <Icon className="size-3.5" />
                      {categoryLabel[category]}
                    </p>
                    <div className="space-y-1">
                      {items.map((item) => (
                        <HelpTip key={item.kind} content={`${item.description} Clique para adicionar ao canvas.`}>
                          <button
                            type="button"
                            onClick={() => addNode(item.kind, null)}
                            className="group flex w-full items-start gap-2 rounded-xl border border-transparent px-2.5 py-2 text-left transition-[background-color,border-color,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:border-border hover:bg-background hover:shadow-sm motion-reduce:transition-none"
                          >
                            <span
                              className={cn(
                                "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border",
                                nodeTone(item.category),
                              )}
                            >
                              <Icon className="size-3.5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-xs font-semibold text-foreground">
                                {item.label}
                              </span>
                              <span className="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                                {item.description}
                              </span>
                            </span>
                          </button>
                        </HelpTip>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </ScrollArea>
        </aside>
        <section
          ref={viewportRef}
          className="relative h-full min-h-0 flex-1 overflow-hidden bg-muted/10 select-none touch-none"
          aria-label="Canvas de automação"
        >
          {/* Floating Studio Controls Bar */}
          <div className="absolute left-4 top-4 z-20 flex items-center gap-1.5 rounded-xl border border-border/80 bg-card/90 p-1.5 shadow-md backdrop-blur">
            <HelpTip content="Diminuir Zoom (Ctrl + Scroll para baixo)">
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={zoomOut}
                aria-label="Diminuir Zoom"
              >
                <Minus className="size-3.5" />
              </Button>
            </HelpTip>

            <span className="w-12 text-center text-xs font-semibold font-mono text-foreground">
              {Math.round(zoom * 100)}%
            </span>

            <HelpTip content="Aumentar Zoom (Ctrl + Scroll para cima)">
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={zoomIn}
                aria-label="Aumentar Zoom"
              >
                <Plus className="size-3.5" />
              </Button>
            </HelpTip>

            <div className="h-4 w-px bg-border my-auto mx-0.5" />

            <HelpTip content="Resetar visão e centralizar canvas">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2.5 text-xs font-medium"
                onClick={resetZoomPan}
              >
                Centralizar
              </Button>
            </HelpTip>

            <span className="border-l border-border pl-2.5 text-xs text-muted-foreground">
              {definition.nodes.length} etapas
            </span>
          </div>

          <div
            ref={canvasRef}
            data-canvas-bg="true"
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            className={cn(
              "absolute inset-0 size-full origin-top-left bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border))_1px,transparent_0)] bg-[size:24px_24px]",
              canvasMode === "move" && (isPanning ? "cursor-grabbing" : "cursor-grab"),
              canvasMode === "connect" && "cursor-crosshair",
              pendingSource && "cursor-crosshair",
              canvasMode === "node" && !isPanning && "cursor-default"
            )}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              width: "5000px",
              height: "4000px",
            }}
          >
            <svg
              className="pointer-events-none absolute inset-0 size-full overflow-visible"
              aria-hidden="true"
            >
              {definition.edges.map((edge) => {
                const source = definition.nodes.find((node) => node.id === edge.source);
                const target = definition.nodes.find((node) => node.id === edge.target);
                if (!source || !target) return null;
                const sx = source.position.x + 116;
                const sy = source.position.y + 126;
                const tx = target.position.x + 116;
                const ty = target.position.y;
                const midY = sy + (ty - sy) / 2;
                return (
                  <g key={edge.id}>
                    <path
                      d={`M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`}
                      fill="none"
                      stroke="currentColor"
                      className="text-border"
                      strokeWidth="2"
                    />
                    <circle cx={tx} cy={ty} r="3" className="fill-primary" />
                  </g>
                );
              })}
            </svg>
            {definition.nodes.map((node) => (
              <WorkflowNodeCard
                key={node.id}
                node={node}
                selected={selectedNodeId === node.id}
                pending={pendingSource?.nodeId === node.id}
                issue={issues.find((item) => item.nodeId === node.id)}
                onPointerDown={(event) => onNodePointerDown(event, node)}
                onSelect={() => setSelectedNodeId(node.id)}
                onOutput={(handle) => {
                  setPendingSource({ nodeId: node.id, handle });
                  setQuickAddSource(null);
                }}
                onQuickAdd={(handle) => {
                  setQuickAddSource({ nodeId: node.id, handle });
                  setPendingSource(null);
                }}
              />
            ))}
            {quickAddSource ? (
              <QuickAdd
                position={
                  definition.nodes.find((node) => node.id === quickAddSource.nodeId)
                    ? {
                        x: (definition.nodes.find((node) => node.id === quickAddSource.nodeId)?.position.x ?? 300) + 250,
                        y: definition.nodes.find((node) => node.id === quickAddSource.nodeId)?.position.y ?? 150,
                      }
                    : { x: 300, y: 150 }
                }
                onClose={() => setQuickAddSource(null)}
                onPick={(kind) => addNode(kind)}
              />
            ) : null}
            {pendingSource ? (
              <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-xl border border-primary/30 bg-card px-3 py-2 text-xs font-medium text-foreground shadow-lg">
                Saída selecionada. Clique no próximo node para conectar.
              </div>
            ) : null}
          </div>
        </section>
        <aside className="hidden h-full min-h-0 overflow-hidden border-l border-border/80 bg-card lg:flex lg:flex-col">
          <Inspector
            node={selectedNode}
            issues={issues}
            description={description}
            onDescriptionChange={(value) => {
              setDescription(value);
              setDirty(true);
              setSaveState("local");
            }}
            onUpdateNode={(next) =>
              updateDefinition({
                ...definition,
                nodes: definition.nodes.map((node) => (node.id === next.id ? next : node)),
              })
            }
            onDelete={() => {
              if (!selectedNode) return;
              updateDefinition(removeWorkflowNode(definition, selectedNode.id));
              setSelectedNodeId(
                definition.nodes.find((node) => node.id !== selectedNode.id)?.id ?? "",
              );
            }}
          />
        </aside>
      </div>
    </div>
  );
}

function WorkflowNodeCard({
  node,
  selected,
  pending,
  issue,
  onPointerDown,
  onSelect,
  onOutput,
  onQuickAdd,
}: {
  node: WorkflowNode;
  selected: boolean;
  pending: boolean;
  issue?: WorkflowValidationIssue;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onSelect: () => void;
  onOutput: (handle: string) => void;
  onQuickAdd: (handle: string) => void;
}) {
  const definition = getWorkflowNodeDefinition(node.kind);
  if (!definition) return null;
  const Icon = categoryIcon[definition.category];
  const outputs = definition.ports.filter((port) => port.direction === "output");
  const configured = !issue;
  return (
    <motion.div
      layout={!pending}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18 }}
      onPointerDown={onPointerDown}
      onClick={onSelect}
      className={cn(
        "absolute w-[14.5rem] touch-none select-none rounded-2xl border bg-card p-3 shadow-sm transition-[box-shadow,border-color,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] motion-reduce:transition-none",
        selected
          ? "border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"
          : "border-border hover:border-primary/45 hover:shadow-md",
        pending && "border-primary",
      )}
      style={{ left: node.position.x, top: node.position.y }}
      title={`${definition.label}: ${nodeGuide(node.kind).how} ${nodeGuide(node.kind).limit}`}
      role="button"
      tabIndex={0}
      aria-label={`Node ${definition.label}`}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-xl border",
            nodeTone(definition.category),
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{definition.label}</p>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
            {definition.description}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2">
        <span
          className={cn(
            "flex items-center gap-1 text-[11px] font-medium",
            configured
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-amber-700 dark:text-amber-300",
          )}
        >
          {configured ? (
            <CheckCircle className="size-3.5" />
          ) : (
            <WarningCircle className="size-3.5" />
          )}
          {configured ? "Configurado" : "Requer atenção"}
        </span>
        <div className="flex items-center gap-1">
          {outputs.map((port) => (
            <React.Fragment key={port.id}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOutput(port.id);
                }}
                className="flex size-5 items-center justify-center rounded-full border border-primary/50 bg-card text-primary shadow-sm transition-transform duration-[var(--duration-micro)] hover:scale-110 motion-reduce:transition-none"
                aria-label={`Conectar saída ${port.label}`}
                title={`Conectar a saída ${port.label} a uma próxima etapa compatível`}
              >
                <span className="size-1.5 rounded-full bg-primary" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onQuickAdd(port.id);
                }}
                className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform duration-[var(--duration-micro)] hover:scale-110 motion-reduce:transition-none"
                aria-label={`Adicionar após ${definition.label}`}
                title="Criar e conectar uma nova etapa após este nó"
              >
                <Plus className="size-3" />
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function QuickAdd({
  position,
  onClose,
  onPick,
}: {
  position: { x: number; y: number };
  onClose: () => void;
  onPick: (kind: WorkflowNodeKind) => void;
}) {
  const [localQuery, setLocalQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const items = listWorkflowNodeDefinitions()
    .filter(
      (item) =>
        item.category !== "trigger" &&
        `${item.label} ${item.description}`
          .toLocaleLowerCase("pt-BR")
          .includes(localQuery.toLocaleLowerCase("pt-BR")),
    )
    .slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      style={{ left: position.x, top: position.y }}
      className="absolute z-30 w-80 rounded-2xl border border-border bg-popover/95 p-3 shadow-xl backdrop-blur"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Adicionar próximo passo</p>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={onClose}>
          Fechar
        </Button>
      </div>
      <Input
        ref={inputRef}
        value={localQuery}
        onChange={(event) => setLocalQuery(event.target.value)}
        placeholder="Buscar ação, condição ou espera"
        className="h-8 text-xs"
      />
      <div className="mt-2 space-y-1">
        {items.map((item) => (
          <button
            key={item.kind}
            type="button"
            onClick={() => onPick(item.kind)}
            className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-muted"
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-lg border",
                nodeTone(item.category),
              )}
            >
              {React.createElement(categoryIcon[item.category], { className: "size-3" })}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-foreground">{item.label}</span>
              <span className="block truncate text-[10px] text-muted-foreground">{item.description}</span>
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function Inspector({
  node,
  issues,
  description,
  onDescriptionChange,
  onUpdateNode,
  onDelete,
}: {
  node: WorkflowNode | null;
  issues: WorkflowValidationIssue[];
  description: string;
  onDescriptionChange: (value: string) => void;
  onUpdateNode: (node: WorkflowNode) => void;
  onDelete: () => void;
}) {
  const definition = node ? getWorkflowNodeDefinition(node.kind) : null;
  if (!node || !definition)
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Selecione uma etapa para ajustar o comportamento e conferir seus dados.
      </div>
    );
  const nodeIssues = issues.filter((item) => item.nodeId === node.id);
  const setConfig = (field: string, value: string) =>
    onUpdateNode({ ...node, config: { ...node.config, [field]: value } });
  const guide = nodeGuide(node.kind);
  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 p-4">
        <div>
          <Badge variant="outline">{categoryLabel[definition.category]}</Badge>
          <h2 className="mt-2 text-base font-semibold">{definition.label}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{definition.description}</p>
        </div>
        <section className="rounded-xl border border-primary/20 bg-primary/[0.045] p-3">
          <p className="text-xs font-semibold text-foreground">Como este nó funciona</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{guide.how}</p>
          <p className="mt-2 rounded-lg bg-card/80 px-2.5 py-2 text-[11px] leading-4 text-foreground">
            <span className="font-semibold">Exemplo: </span>
            {guide.example.replace("Exemplo: ", "")}
          </p>
          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
            <span className="font-semibold text-foreground">Importante: </span>
            {guide.limit}
          </p>
        </section>
        {nodeIssues.length > 0 ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
              <WarningCircle className="size-4" />
              Precisa de ajuste
            </p>
            <ul className="mt-2 space-y-1 text-[11px] leading-4 text-amber-800/80 dark:text-amber-100/80">
              {nodeIssues.map((issue) => (
                <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-200">
            <CheckCircle className="mr-1 size-4" />
            Configuração pronta para continuar.
          </div>
        )}
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Configuração
          </p>
          {definition.editableFields.length ? (
            definition.editableFields.map((field) => (
              <label key={field} className="grid gap-1.5 text-xs font-medium text-foreground">
                <span>
                  {field === "match"
                    ? "Regra"
                    : field === "duration"
                      ? "Duração"
                      : field === "dueInMinutes"
                        ? "Prazo em minutos"
                        : field === "message"
                          ? "Mensagem"
                          : field === "title"
                            ? "Título"
                            : field === "tag"
                              ? "Etiqueta"
                              : field}
                </span>
                <Input
                  value={typeof node.config[field] === "string" ? node.config[field] : ""}
                  onChange={(event) => setConfig(field, event.target.value)}
                  placeholder={
                    field === "match" ? "Ex.: lead.classificação é quente" : `Defina ${field}`
                  }
                  className="h-9 text-xs"
                />
                {field === "message" || field === "prompt" ? (
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setConfig(field, `${String(node.config[field] ?? "")}{{lead.nome}}`)
                      }
                      className="rounded-md border border-border px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-muted"
                    >
                      Inserir nome do lead
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfig(field, `${String(node.config[field] ?? "")}{{lead.telefone}}`)
                      }
                      className="rounded-md border border-border px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-muted"
                    >
                      Inserir telefone
                    </button>
                  </div>
                ) : null}
              </label>
            ))
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              Este gatilho não precisa de configuração adicional.
            </p>
          )}
        </section>
        <section className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Entradas e saídas
          </p>
          {definition.ports.map((port) => (
            <div
              key={`${port.direction}-${port.id}`}
              className="flex items-center justify-between text-xs"
            >
              <span>{port.label}</span>
              <span className="text-muted-foreground">
                {port.direction === "input" ? "Entrada" : "Saída"} · {port.dataType}
              </span>
            </div>
          ))}
        </section>
        <section className="space-y-2 border-t border-border pt-4">
          <label className="grid gap-1.5 text-xs font-medium">
            <span>Contexto da automação</span>
            <Input
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              className="h-9 text-xs"
            />
          </label>
        </section>
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash className="size-4" />
          Remover etapa
        </Button>
      </div>
    </ScrollArea>
  );
}
