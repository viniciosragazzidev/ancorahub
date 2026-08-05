"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileArrowDown } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function InternalReportDocuments({
  documents,
}: {
  documents: Array<{ id: string; title: string; filename: string; createdAt: Date }>;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function upload(formData: FormData) {
    setPending(true);
    setMessage(null);
    const response = await fetch("/api/reports/documents/upload", {
      method: "POST",
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) return setMessage(data.error ?? "Não foi possível importar o PDF.");
    formRef.current?.reset();
    setMessage("PDF salvo nos documentos internos.");
    router.refresh();
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Documentos internos</CardTitle>
        <CardDescription>
          Guarde relatórios em PDF de forma privada para a equipe autorizada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form ref={formRef} action={upload} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input
            name="title"
            required
            minLength={2}
            maxLength={140}
            placeholder="Título do relatório"
          />
          <Input name="file" required type="file" accept="application/pdf" />
          <Button disabled={pending} type="submit">
            {pending ? "Salvando..." : "Importar PDF"}
          </Button>
        </form>
        {message && (
          <p className="text-sm text-muted-foreground" role="status">
            {message}
          </p>
        )}
        <div className="divide-y rounded-lg border">
          {documents.length ? (
            documents.map((document) => (
              <a
                className="flex items-center justify-between gap-3 p-3 text-sm transition-colors hover:bg-muted/50"
                href={`/api/reports/documents/${document.id}`}
                key={document.id}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{document.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {document.filename}
                  </span>
                </span>
                <FileArrowDown className="size-4 shrink-0 text-primary" />
              </a>
            ))
          ) : (
            <p className="p-3 text-sm text-muted-foreground">
              Nenhum PDF interno foi importado ainda.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
