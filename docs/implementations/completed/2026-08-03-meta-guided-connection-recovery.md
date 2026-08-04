# Correção do acesso à integração Meta

## Objetivo

Substituir em `/settings/meta` o popup incompatível de cadastro do WhatsApp pelo
fluxo guiado de Meta Lead Ads já aprovado em DEC-070.

## Escopo entregue

- A rota agora carrega `MetaManualIntegrationWorkspace`, em vez do fluxo legado que
  misturava Embedded Signup do WhatsApp e OAuth de Lead Ads.
- `manual-meta-queries.ts` fornece o resumo da tela a partir do contexto de sessão
  confiável: canal oficial, fontes de Lead Ads, estado do piloto, configuração da
  plataforma e identidade pública do parceiro.
- Toda consulta de tenant aplica o `tenantId` derivado da sessão; nenhum identificador
  de empresa é recebido pelo navegador como autoridade.
- O Diretor passa a abrir apenas as configurações oficiais da Meta e a buscar os
  ativos autorizados pela credencial técnica da plataforma. A configuração do WhatsApp
  continua em aba independente, com token validado, cifrado e nunca exibido depois.

## Segurança e governança

- Mantidos os controles existentes: capacidade `acessar_integracao_meta`, Diretor
  como responsável pela configuração, kill switch global, piloto por tenant e auditoria
  das alterações de canal e fontes.
- A entrega não cria credenciais, webhooks, migração de banco ou integração externa.
  OAuth/Embedded Signup segue fora do fluxo até a homologação prevista em N67.

## Validação

- `git diff --check`
- `npm run type-check`
- `npm run test -- --run src/features/communication-channels/manual-meta-input.test.ts` — 3 testes aprovados.
- `npm run agent:verify -- --level fast` — 55 arquivos e 231 testes aprovados.
- `npm run build` — compilação de produção concluída com sucesso.
- `npm run agent:verify -- --level full` — tipos, testes, segurança e build aprovados;
  o comando encerra com erro apenas por 325 erros de lint preexistentes em arquivos
  fora deste escopo, incluindo `update_cards.js` e `latitude-llm-reference/`.
- Evidências: `reports/agent/verification/2026-08-03T18-10-14.710Z.md` e
  `reports/agent/verification/2026-08-03T18-16-13.704Z.md`.

## Rollback

Reverter `src/app/(dashboard)/settings/meta/page.tsx` e remover
`src/features/communication-channels/manual-meta-queries.ts` restaura a tela anterior.
Não há alteração de dados.
