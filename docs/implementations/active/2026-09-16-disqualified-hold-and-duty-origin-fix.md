# Retenção de desqualificados e plantão por origem

## Escopo

- A chave global `tenants.hold_disqualified_leads` nasce desligada e pode ser
  alterada somente pelo Diretor em `/distribuicao?view=roteamento`.
- Com a chave ligada, `processQueuedLead` mantém leads `disqualified` em espera
  antes de criar ofertas. Uma regra ativa em modo `manual` que seleciona
  explicitamente o status `Desqualificado` é a exceção auditada.
- O resolvedor de plantão trata `webhookCredentialId = null` como “Todas as
  origens”, inclusive quando o lead chega por uma credencial específica. Um
  plantão vinculado a uma credencial continua restrito àquela credencial.

## Evidência da causa corrigida

Em 16/09/2026, a unidade `Unidade Testes` tinha o plantão ativo `09:00–18:00`
com `webhookCredentialId = null` e um corretor ativo na escala. Leads da mesma
fila possuíam credenciais de webhook e jobs registravam `AWAITING_ELIGIBILITY`.
O filtro anterior descartava o plantão global quando a credencial do lead era
preenchida, deixando a fila sem candidatos.

## Operação e migração

Aplicar `drizzle/0148_hold_disqualified_leads.sql` no banco do serviço API antes
de ativar a chave. Em deployments antigos, a leitura permanece desligada por
fallback seguro e a ação informa que a migration está pendente.

## Verificação

- `npm run db:check` passou.
- `npm run build` passou.
- Testes focados de retenção, matching de plantão, plantão multi-dia e regras de
  roteamento passaram (18 testes).
- `npm run type-check` ficou bloqueado apenas por script diagnóstico paralelo
  `scripts/_tmp-diag2.ts` (erro TS18047 em `p.userId`), fora deste escopo.
