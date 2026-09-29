"use client";

import { CheckCircle, FileText, Pause, ArrowsClockwise, Trash, X, HelpCircle } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Document = {
  id: string;
  filename: string;
  status: string;
  requirementType?: string;
  url?: string;
  size?: number;
};

type Requirement = {
  id: string;
  type: string;
  label: string;
  required: boolean;
};

type BrokerDocumentsPanelProps = {
  documents: Document[];
  requirements: Requirement[];
};

export function BrokerDocumentsPanel({ documents, requirements }: BrokerDocumentsPanelProps) {
  return (
    <div className="flex flex-col gap-6 bg-card rounded-xl border border-border/40 p-5 md:p-6 w-full shadow-sm text-card-foreground">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-base font-medium text-foreground">Anexar documento</h3>
          <p className="text-[13px] text-muted-foreground mt-0.5">Adicione os documentos do lead! Mostre o seu melhor trabalho</p>
        </div>
        <Button aria-label="Fechar" className="text-muted-foreground" size="icon-sm" variant="ghost">
          <X className="size-4" />
        </Button>
      </div>

      <div className="border border-dashed border-border/60 rounded-xl p-8 flex flex-col items-center justify-center bg-muted/20 gap-3">
        <div className="text-primary mb-1">
          <FileText className="size-9" aria-hidden="true" />
        </div>
        <div className="text-center">
          <p className="font-medium text-foreground text-sm">Arraste seus arquivos aqui</p>
          <p className="text-xs text-muted-foreground mt-1">Suportamos JPG, PNG, PDF (máx. 10MB)</p>
        </div>
        <Button variant="outline" size="sm" className="mt-2 bg-transparent border-border/60 hover:bg-secondary">
          Selecionar arquivo
        </Button>
      </div>

      <div className="space-y-3">
        {/* Mock Item 1 - PNG */}
        <div className="relative rounded-lg bg-secondary/30 p-3 flex items-center justify-between border border-border/40 overflow-hidden">
          <div className="flex items-center gap-3 relative z-10 w-full">
            <div className="w-10 h-10 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-[10px] shrink-0">
              PNG
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">Sunset-photo-2025.png</p>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-xs text-muted-foreground truncate">1.2 MB / 4 MB - 2 minutos restando...</p>
                <div className="flex items-center gap-3 pl-2">
                  <span className="text-xs font-medium text-muted-foreground">30%</span>
                  <Button aria-label="Pausar upload" className="text-muted-foreground" size="icon-sm" variant="ghost"><Pause className="size-4"/></Button>
                  <Button aria-label="Cancelar upload" className="text-muted-foreground" size="icon-sm" variant="ghost"><X className="size-4"/></Button>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 h-[3px] bg-primary w-[30%]" />
          <div className="absolute bottom-0 left-0 h-[3px] bg-secondary w-full -z-10" />
        </div>
        
        {/* Mock Item 2 - PDF Failed */}
        <div className="relative rounded-lg bg-secondary/30 p-3 flex items-center justify-between border border-destructive/30 overflow-hidden">
          <div className="flex items-center gap-3 relative z-10 w-full">
            <div className="w-10 h-10 rounded bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-[10px] shrink-0">
              PDF
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">France-Photo-Summit.pdf</p>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-xs text-red-400 truncate">819.2 KB / 8 MB - falhou</p>
                <div className="flex items-center gap-3 pl-2">
                  <span className="text-xs font-medium text-red-400">20%</span>
                  <Button aria-label="Tentar novamente" className="text-muted-foreground" size="icon-sm" variant="ghost"><ArrowsClockwise className="size-4"/></Button>
                  <Button aria-label="Remover arquivo" className="text-muted-foreground" size="icon-sm" variant="ghost"><X className="size-4"/></Button>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 h-[3px] bg-red-500 w-[20%]" />
          <div className="absolute bottom-0 left-0 h-[3px] bg-secondary w-full -z-10" />
        </div>
        
        {/* Mock Item 3 - PDF Success */}
        <div className="relative rounded-lg bg-secondary/30 p-3 flex items-center justify-between border border-border/40 overflow-hidden">
          <div className="flex items-center gap-3 relative z-10 w-full">
            <div className="w-10 h-10 rounded bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-[10px] shrink-0">
              PDF
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">My-Photo-Portfolio.pdf</p>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-xs text-green-500 truncate">4 MB - concluído</p>
                <div className="flex items-center gap-3 pl-2">
                  <span className="text-xs font-medium text-green-500">100%</span>
                  <CheckCircle className="size-4 text-green-500"/>
                  <Button aria-label="Excluir arquivo" className="text-muted-foreground" size="icon-sm" variant="ghost"><Trash className="size-4"/></Button>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 h-[3px] bg-green-500 w-full" />
        </div>
      </div>

      <div className="flex items-center gap-4 py-1">
        <div className="h-px bg-border flex-1" />
        <span className="text-xs text-muted-foreground font-medium">Ou via URL</span>
        <div className="h-px bg-border flex-1" />
      </div>

      <div className="flex items-center border border-border rounded-md overflow-hidden bg-background focus-within:ring-1 focus-within:ring-primary/50 transition-all">
        <div className="bg-muted/30 px-3 py-2 text-sm text-muted-foreground border-r border-border">http://</div>
        <Input type="url" placeholder="Cole seu link aqui" className="flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0" />
        <Button variant="ghost" size="sm" className="rounded-none px-4 hover:bg-secondary border-l border-border">Enviar</Button>
      </div>

      <div className="flex items-center justify-between mt-2">
        <Button className="text-muted-foreground" size="sm" variant="ghost">
          <HelpCircle className="size-4" /> Ajuda
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="bg-transparent border-border hover:bg-secondary">Descartar</Button>
          <Button variant="default" size="sm">Anexar arquivo</Button>
        </div>
      </div>
    </div>
  );
}
