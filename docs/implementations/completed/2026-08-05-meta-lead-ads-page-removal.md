# Remoção reversível de Página Meta Lead Ads

## Objetivo

Permitir que o Diretor desconecte uma Página adicionada por engano, sem apagar leads, registros de auditoria ou dados históricos.

## Entrega

- A lista **Páginas conectadas** em `/settings/meta` agora oferece **Remover** para fontes ativas.
- A remoção pausa a fonte e revoga a credencial interna de recebimento; nenhum novo lead é aceito para ela.
- A ação usa a autorização de Lead Ads, respeitando piloto por empresa e a flag global, sem exigir que o canal de WhatsApp Oficial esteja habilitado.
- A Página permanece no histórico como **Removida** e pode ser ativada novamente pelo fluxo normal.

## Segurança e rollback

- `pauseMetaLeadAdsSource` valida tenant e ownership, preserva os dados e registra `meta_lead_ads.source_paused` na auditoria.
- Não há exclusão de dados ou migração de banco.
- Para voltar a receber, o Diretor busca os ativos autorizados e ativa a mesma Página novamente.

## Validações

- `npm run agent:verify -- --level fast` — documentação válida, type-check e 247 testes aprovados.
- `npm run build` — build de produção concluído com sucesso.
