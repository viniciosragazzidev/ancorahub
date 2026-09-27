"use client";

import { useState } from "react";

import { TemplateListView } from "../../integrations/whatsapp/_components/template-list-view";
import { MessageLibraryCard } from "./message-library-card";
import { MessagePoliciesPanel } from "./message-policies-panel";

export function MessageAutomationStudio({ canManage }: { canManage: boolean }) {
  const [preferredMetaTemplateId, setPreferredMetaTemplateId] = useState<string | null>(null);
  const [preferredEventKey, setPreferredEventKey] = useState<string | null>(null);

  return (
    <section className="grid gap-6" aria-label="Estúdio de mensagens automáticas">
      <MessageLibraryCard />
      <TemplateListView
        canManage={canManage}
        onUseTemplate={canManage ? (templateId, eventKey) => {
          setPreferredMetaTemplateId(templateId);
          setPreferredEventKey(eventKey);
        } : undefined}
      />
      <MessagePoliciesPanel
        canManage={canManage}
        preferredMetaTemplateId={preferredMetaTemplateId}
        preferredEventKey={preferredEventKey}
        onPreferredMetaTemplateApplied={() => {
          setPreferredMetaTemplateId(null);
          setPreferredEventKey(null);
        }}
      />
    </section>
  );
}
