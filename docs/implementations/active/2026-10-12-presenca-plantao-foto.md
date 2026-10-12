# Confirmação de presença no plantão (Início + foto no presencial)

Data: 2026-10-12. Decisão do Vinicios: no plantão presencial, a foto do local libera o corretor sozinha (antes só o gestor liberava).

## Como funciona
- De 30 min antes até o fim do plantão, o Início e a conversa do Plantão mostram o card "Confirme sua presença".
- Online: um toque (`POST /api/duty/presence`).
- Presencial: o botão abre a câmera (`capture="environment"`); a foto é conferida pelos bytes, recodificada no servidor (sharp: JPEG até 1600px, sem metadados, sem GPS) e guardada no R2 em `duty-presence/{tenant}/{corretor}/...jpg`. A confirmação grava `confirmed_by` = o próprio corretor, que é o que a distribuição já lê para liberar.
- Falta marcada pela gestão bloqueia antes do envio da foto e nunca é sobrescrita.
- Gestor (diretor ou gerente do branch) vê a foto em "Ver foto do local" no detalhe do corretor no plantão (`GET /api/duty/presence/photo?id=`).

## Migração
`drizzle/0195_duty_presence_photo.sql`: 2 colunas nulas (`photo_storage_key`, `photo_taken_at`).

## Pendências
- **Retenção:** hoje as fotos ficam guardadas sem prazo. Proposta: apagar com 90 dias (job a criar e colocar no runbook do Coolify).
- O lembrete por WhatsApp continua sem ir para o presencial (só no app).
- A página pública `/confirm_presence` (link do WhatsApp, online) segue com o visual antigo.
