"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ExtensionHelpDialog({ version }: { version: string }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" aria-label="Como funciona o AncoraHub Assistant" />}>
        ? Como funciona
      </DialogTrigger>
      <DialogPopup>
        <DialogPanel>
          <DialogHeader>
            <DialogTitle>AncoraHub Assistant no WhatsApp Web</DialogTitle>
            <DialogDescription>Um apoio contextual para o seu atendimento — nunca um disparador automático.</DialogDescription>
          </DialogHeader>
          <ol className="mt-5 space-y-4 text-sm text-muted-foreground">
            <li><strong className="text-foreground">1. Baixe e extraia.</strong> Use o pacote v{version} disponível nesta página.</li>
            <li><strong className="text-foreground">2. Ative o modo desenvolvedor.</strong> Abra <code>chrome://extensions</code> e ligue essa opção.</li>
            <li><strong className="text-foreground">3. Carregue a extensão.</strong> Clique em “Carregar sem compactação” e escolha a pasta extraída.</li>
            <li><strong className="text-foreground">4. Conecte em um clique.</strong> Clique no ícone da extensão e em “Conectar ao CRM”. Se necessário, o código temporário continua disponível como alternativa.</li>
            <li><strong className="text-foreground">5. Atualize manualmente.</strong> A cada versão nova, baixe e extraia o pacote pelo CRM e clique em “Atualizar” em <code>chrome://extensions</code>.</li>
            <li><strong className="text-foreground">6. Atenda com segurança.</strong> Você decide cada ação; a extensão não envia mensagens automaticamente nem lê listas de contatos.</li>
          </ol>
          <DialogFooter className="mt-6">
            <DialogClose render={<Button variant="outline" />}>Entendi</DialogClose>
          </DialogFooter>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
