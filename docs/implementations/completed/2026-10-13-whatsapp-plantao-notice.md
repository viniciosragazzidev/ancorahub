# Aviso de WhatsApp para leads do plantão

Em 13/10/2026, foi implementado o aviso informativo para corretores (`broker`) cuja conexão própria de WhatsApp não está `ready`. O aviso diário aparece no dashboard no primeiro acesso do dia e pode ser fechado até o próximo dia local; o mesmo componente fica fixo no topo da conversa com Jack enquanto a conexão não estiver pronta. Ambos são ocultados quando a conexão fica pronta ou quando a flag global `feature_whatsapp_plantao_notice_enabled` é desligada.

No computador, o CTA abre o diálogo existente de conexão. Em dispositivos sem ponteiro fino ou com viewport abaixo de 1024px, o CTA informa que a conexão deve ser iniciada no computador e não busca QR code. Fechamento e clique no CTA são registrados em `audit_logs`. A configuração da flag fica no Super Admin. Nenhuma migration foi criada e a distribuição de leads não foi alterada.

O copy do onboarding de disponibilidade foi atualizado e as instruções do Jack agora informam a exigência a partir de 20/10/2026. A decisão de produto está em DEC-139; o roadmap registra N105 como parcial, pois esta entrega só comunica a regra futura.

## Validação

- `npx vitest run src/components/whatsapp/whatsapp-plantao-notice.test.tsx`: aprovado, 3 testes.
- `npm run type-check`: aprovado.
- `npx eslint` sobre os arquivos TS/TSX alterados: aprovado sem erros. Permanecem três avisos em código preexistente: dois `no-unused-vars` em `super-admin/actions.ts` e um `set-state-in-effect` no diálogo de conexão.
- A suíte completa foi interrompida por orientação do Maestro devido à lentidão e falhas fora do escopo T120; somente as validações focadas acima foram executadas para esta entrega.

## Reversão

Desligar `WhatsApp Plantão: Aviso de conexão` no Super Admin oculta os dois avisos sem migration. Para remover a implementação, reverter este commit.
