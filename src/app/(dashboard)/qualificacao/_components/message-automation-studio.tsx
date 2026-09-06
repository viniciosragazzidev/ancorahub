"use client";

import { useState } from "react";

import { TemplateListView } from "../../integrations/whatsapp/_components/template-list-view";
import { MessagePoliciesPanel } from "./message-policies-panel";

export function MessageAutomationStudio({ canManage }: { canManage: boolean }) {
  const [preferredMetaTemplateId, setPreferredMetaTemplateId] = useState<string | null>(null);

  return (
    <section className="grid gap-6" aria-label="Estúdio de mensagens automáticas">
      <TemplateListView canManage={canManage} onUseTemplate={canManage ? setPreferredMetaTemplateId : undefined} />
      <MessagePoliciesPanel
        canManage={canManage}
        preferredMetaTemplateId={preferredMetaTemplateId}
        onPreferredMetaTemplateApplied={() => setPreferredMetaTemplateId(null)}
      />
    </section>
  );
}
