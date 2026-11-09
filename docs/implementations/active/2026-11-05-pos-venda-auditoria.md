# Pós-venda e auditoria de atendimento

**Estado:** Fase 1 concluída; Fases 2 e 3 pendentes. **Flag global:** `feature_post_sale_audit_enabled`, desligada por padrão.

## Contrato aprovado

- Diretor e gestor da unidade podem selecionar uma audiência autorizada, pré-visualizar exclusões e iniciar uma campanha. Todo acesso filtra pelo tenant autenticado; gestor permanece na própria unidade.
- Os leads são excluídos por telefone inválido, opt-out/número incorreto, pesquisa nos últimos 60 dias, registro apagado/arquivado ou conversa humana ativa nas últimas 24 horas. Limite de 300 leads elegíveis por campanha.
- A campanha conserva o canal/número de origem: primeira mensagem inbound; na ausência, primeiro contato outbound; depois, associação única do canal com a fila/unidade. Canal ausente, ambíguo ou desconectado é pulado com motivo, sem trocar de número.
- Exceções aprovadas pelo Vinicios em 06/11/2026 (motivo: na primeira campanha, 31 de 118 leads ficaram fora só por falta de registro do número, e 31 por origem no WhatsApp pessoal do corretor):
  - Origem no número oficial (Meta) sem canal registrado na mensagem, ou com canal hoje inativo (ex.: 99449-6129, desativado): usa o canal Meta padrão ativo (`is_default`, mesma unidade ou sem unidade), com o template aprovado na WABA dele. Sem canal padrão, continua pulado.
  - Origem WAHA sem número da empresa (WhatsApp pessoal do corretor) ou lead sem fonte: WAHA da unidade do lead ou da empresa. Nunca o celular do corretor.
  - Canal ambíguo (mais de um possível para a fila/unidade) continua pulado, sem troca.
- WAHA recebe texto de apresentação pelo número exato de origem. Meta recebe somente o template aprovado `pos_venda_apresentacao` na WABA do número de origem. Após eventual resposta, a conversa segue em texto livre no mesmo canal.
- Disparo idempotente pelo identificador `post-sale:<campaignId>:<leadId>`, dentro do outbox. O guard de horário e ritmo protege também `postSaleSurvey`; falha do canal de origem não pode migrar para outro canal.
- Cada campanha e resultado de prévia/disparo são auditáveis sem incluir conteúdo ou telefone na metadata.

## Fases

1. Dados, público, resolução do canal e enfileiramento inicial.
2. Roteiro de conversa, opt-out, fallback determinístico, lembrete e integração inbound.
3. Alertas, telas de campanha, relatório por corretor e superfícies no lead.

## Fase 1

- Migration manual: `drizzle/0217_post_sale_audit_campaigns.sql`. Não executar contra banco nesta tarefa.
- Reutilizar outbox, template approval e limites da comunicação. Template: categoria inicial UTILITY, `pt_BR`, corpo e quick replies conforme demanda; aprovação MARKETING também é elegível.
- A submissão usa o fluxo existente da tela de templates Meta: aplicar o preset “Preencher template de pós-venda”, enviar para a WABA e sincronizar depois da aprovação no WhatsApp Manager. Até a aprovação, o preview identifica e exclui os leads daquele número Meta.
- `channel_ref` é polimórfico por `channel_type`; resolução futura do inbound consulta survey estritamente por tenant + lead + canal.

## Verificação por fase

Registrar abaixo os testes e commits de cada fase. Não copiar `.env.local`, não executar migração nem teste que conecte ao banco de produção.

### Verificação Fase 1

- `npx tsc --noEmit`: aprovado.
- Vitest direcionado: 7 arquivos, 94 testes aprovados, com `DATABASE_URL` e `SUPABASE_DB_URL` removidos do processo.
- ESLint nos arquivos alterados: 0 erros; 11 avisos em `any`/import não usado nos componentes compartilhados já existentes.
- `git diff --check`: aprovado.
- Commit da Fase 1: `feat: iniciar campanhas de auditoria de pós-venda`.
- Migration não executada; build e harness integral não executados.
