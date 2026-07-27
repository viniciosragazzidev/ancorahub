# Padrões profissionais do CorreTop

**Status:** norma de planejamento (não altera funcionalidades)  
**Data:** 21/07/2026  
**Escopo:** organização de arquivos, segurança, acessibilidade, design, compatibilidade, desempenho, testes e entrega.

## Como usar

Este diretório é o índice operacional para qualquer implementação nova ou refatoração. Os documentos definem regras; não autorizam por si só uma mudança de produto ou de negócio.

### Ordem de precedência

1. Solicitação atual do usuário.
2. `docs/decision-log.md` para decisões aprovadas e pendências bloqueantes.
3. `docs/business-rules.md` e `CONTEXT.md` para regras e vocabulário do domínio.
4. `AI_RULES.md` e `AGENTS.md` para o processo de execução.
5. `DESIGN.md` e `docs/ui-foundation.md` para a interface.
6. Os padrões deste diretório para execução técnica.
7. Documentos históricos, planos e logs apenas como contexto.

Se houver conflito, não escolha silenciosamente: registre a divergência, preserve o comportamento atual e abra uma decisão em `docs/decision-log.md` antes de alterar o escopo.

## Documentos normativos

| Documento | Cobre | Quando consultar |
|---|---|---|
| [file-organization.md](./file-organization.md) | Pastas, fronteiras, nomes e dependências | Antes de criar ou mover arquivos |
| [domain-contracts.md](./domain-contracts.md) | Vocabulário, invariantes e estados | Antes de alterar regra ou fluxo |
| [security.md](./security.md) | Multi-tenant, autenticação, autorização, LGPD, segredos e auditoria | Toda leitura, mutação ou integração |
| [accessibility.md](./accessibility.md) | Semântica, teclado, foco, contraste, zoom e leitores de tela | Toda superfície de UI |
| [design-system.md](./design-system.md) | Tokens, componentes, densidade, responsividade e motion | Toda alteração visual |
| [performance-compatibility.md](./performance-compatibility.md) | Web Vitals, banco, cache, browsers e mobile | Toda rota, query ou dependência |
| [testing-observability.md](./testing-observability.md) | Testes, logs, métricas, alertas e recuperação | Toda mudança de risco operacional |
| [delivery-governance.md](./delivery-governance.md) | Definition of Done, migrations, revisão e deploy | Antes de concluir ou publicar |

## Regra de adoção

Os padrões passam a valer imediatamente para arquivos novos. Arquivos existentes só devem ser reorganizados em lotes pequenos, com comportamento preservado, validação e commit separado. Não fazer uma grande movimentação mecânica do repositório.

## Plano em ondas

1. **Onda 0 — inventário:** confirmar o caminho real, donos do módulo, dependências e testes.
2. **Onda 1 — novos arquivos:** aplicar as regras sem mover legado.
3. **Onda 2 — seams profundos:** extrair contratos, políticas e serviços quando houver duplicação ou risco.
4. **Onda 3 — migração segura:** mover um domínio por vez, mantendo adapters temporários e links atualizados.
5. **Onda 4 — limpeza:** remover adapters obsoletos somente após observabilidade e validação de produção.

## Não fazer

- Não mover arquivos apenas para “ficar bonito”.
- Não introduzir pacote ou padrão de arquitetura por preferência pessoal.
- Não misturar refatoração estrutural com mudança de regra de negócio sem uma decisão registrada.
- Não declarar uma migração concluída enquanto existirem imports antigos, testes ausentes ou documentação desatualizada.
