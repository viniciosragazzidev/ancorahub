# CorreTop

CRM SaaS multi-tenant para corretoras de planos de saúde. O projeto está na fase de
fundação documental e de governança: nenhuma integração ou dependência complementar
foi instalada nesta preparação.

## Ponto de partida

| Precisa de… | Consulte |
|---|---|
| Regras para IA e colaboradores | [AI_RULES.md](AI_RULES.md) e [AGENTS.md](AGENTS.md) |
| Navegar a documentação | [docs/README.md](docs/README.md) |
| Regras implementáveis do produto | [docs/business-rules.md](docs/business-rules.md) |
| Decisões que precisam de aprovação | [docs/decision-log.md](docs/decision-log.md) |
| Requisitos e contexto de negócio | [CorreTop_Documento_Requisitos.md](CorreTop_Documento_Requisitos.md) |
| Arquitetura e processo | [CorreTop_Arquitetura_Desenvolvimento.md](CorreTop_Arquitetura_Desenvolvimento.md) |
| Linguagem visual | [DESIGN.md](DESIGN.md) |
| Fundação obrigatória de UI e motion | [docs/ui-foundation.md](docs/ui-foundation.md) |

## Estado atual

- Next.js `16.2.10`, React `19.2.4`, TypeScript e Tailwind CSS já vêm do bootstrap.
- Banco, autenticação, ORM, storage, cobrança, testes, CI e integrações ainda não foram
  escolhidos/instalados nesta etapa.
- O MCP do shadcn está configurado em `.vscode/mcp.json`; `transitions-dev` está
  instalado no repositório. Componentes Unlumen serão adicionados somente quando uma
  tela justificar sua adoção.
- A aplicação usa `src/`: rotas em `src/app`, domínios em `src/features` e código
  transversal em `src/shared`. Consulte [architecture-map.md](docs/architecture-map.md).
- Copie `.env.example` para `.env.local` somente quando a integração correspondente
  estiver aprovada. Nunca registre segredos no Git.

## Comandos disponíveis

```bash
npm run dev
npm run lint
npm run build
npm run start
```

Antes de implementar uma feature, siga `docs/engineering-checklist.md`. Antes de
alterar código Next.js, consulte a documentação local correspondente em
`node_modules/next/dist/docs/`, conforme `AGENTS.md`.
