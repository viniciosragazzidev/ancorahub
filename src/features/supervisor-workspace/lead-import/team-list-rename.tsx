"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { Button } from "@/components/arc/button/button";
import { LiteActionButton } from "@/components/lite/controls/action-button";
import { LiteMenu } from "@/components/lite/controls/menu";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import form from "@/components/lite/page/lite-form.module.css";

import { LIST_NAME_MAX, cleanListName } from "./list-names";
import { useTeamListApi } from "./team-list-import";

/**
 * Menu "⋯" da lista importada (DEC-191) com "Renomear lista" num painel lateral. Nível 1 do FEEDBACK.md: o botão
 * confirma só depois do servidor; erro mantém o nome digitado e oferece tentar de novo.
 */
export function TeamListRename({ listId, name, onRenamed }: { listId: string; name: string; onRenamed?: (name: string) => void }) {
  const router = useRouter();
  const api = useTeamListApi();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- só sabe que está no navegador depois de montar
  useEffect(() => setMounted(true), []);
  if (!api.renameList) return null;
  const rename = api.renameList;
  const clean = cleanListName(value);

  return (
    <>
      <LiteMenu label={`Ações da ${name}`} items={[{ id: "rename", label: "Renomear lista", onSelect: () => { setValue(name); setOpen(true); } }]} />
      {mounted ? createPortal(<div className="arc-venancor"><LiteSidePanel open={open} onOpenChange={setOpen} title="Renomear lista" description="O nome aparece nas suas listas importadas. Os leads continuam iguais.">
        <div className={form.form}>
          <div className={form.field}>
            <label className={form.label} htmlFor="team-list-rename">Nome da lista</label>
            <input id="team-list-rename" className={form.input} value={value} maxLength={LIST_NAME_MAX} onChange={(event) => setValue(event.target.value)} autoFocus />
          </div>
          <div className={form.actions}>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <LiteActionButton
              busyLabel="Salvando…"
              doneLabel="Salvo"
              disabled={!clean || clean === name}
              keeps="O nome antigo continua."
              onAction={async () => {
                const result = await rename({ listId, name: clean });
                if (!result.ok) return { ok: false, message: result.error };
                onRenamed?.(result.data.name);
                return { ok: true };
              }}
              onDone={() => { setOpen(false); router.refresh(); }}
            >
              Salvar nome
            </LiteActionButton>
          </div>
        </div>
      </LiteSidePanel></div>, document.body) : null}
    </>
  );
}
