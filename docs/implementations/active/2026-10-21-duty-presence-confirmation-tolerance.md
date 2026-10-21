# Tolerância da confirmação própria de presença

## Objetivo

Impedir que o corretor confirme a própria presença mais de 20 minutos após o início da ocorrência, preservando a abertura 30 minutos antes e a liberação manual da gestão.

## Regra e decisão

- A janela de autoconfirmação começa 30 minutos antes de `startsAt` e permite confirmação até o minuto 20, inclusive.
- Depois do limite, `resolveOwnDutyOccurrence`, `confirmOwnDutyPresence`, o link de lembrete e a ação com foto devolvem a orientação única para procurar o supervisor.
- O link público aplica o limite dentro da atualização condicional, além da checagem ao abrir a tela.
- A liberação manual continua no fluxo existente. Nenhuma migration ou mudança de esquema.
- DEC-119 e BR-086 registram a regra aprovada pelo Vinicios.

## Arquivos previstos

- `src/features/lead-distribution/duty-presence-domain.ts` e o teste de domínio.
- `src/features/lead-distribution/duty-presence.ts`.
- `/api/duty/presence`, `/api/public/duty-presence/confirm` e `/confirm_presence`.
- `docs/decision-log.md`, `docs/business-rules.md` e `src/features/roadmap/roadmap-data.ts`.

## Validação

Pendente: testes focados solicitados, `npx tsc --noEmit -p .`, `npm run agent:verify -- --level full` e build exigidos pelo harness local.

## Riscos e reversão

A gravação e a liberação manual existentes são preservadas. Reverter a regra consiste em remover os limites de tempo dos dois caminhos de autoconfirmação e restaurar o texto de DEC-119.
