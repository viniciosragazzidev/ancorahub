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

export function ExtensionHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" aria-label="Como funciona o CorreTop Assistant" />}>
        ? Como funciona
      </DialogTrigger>
      <DialogPopup>
        <DialogPanel>
          <DialogHeader>
            <DialogTitle>CorreTop Assistant no WhatsApp Web</DialogTitle>
            <DialogDescription>Um apoio contextual para o seu atendimento — nunca um disparador automático.</DialogDescription>
          </DialogHeader>
          <ol className="mt-5 space-y-4 text-sm text-muted-foreground">
            <li><strong className="text-foreground">1. Instale.</strong> Baixe o arquivo abaixo e adicione a extensão no Chrome. Não há comando para executar.</li>
            <li><strong className="text-foreground">2. Ative neste navegador.</strong> Gere o código temporário nesta tela e informe-o no popup da extensão.</li>
            <li><strong className="text-foreground">3. Abra o WhatsApp Web.</strong> O painel só aparece quando a conversa pertence a um lead atribuído a você e à sua unidade.</li>
            <li><strong className="text-foreground">4. Trabalhe com segurança.</strong> Você decide cada ação; a extensão não envia mensagens, não abre conversas e não lê listas de contatos.</li>
          </ol>
          <DialogFooter className="mt-6">
            <DialogClose render={<Button variant="outline" />}>Entendi</DialogClose>
          </DialogFooter>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
