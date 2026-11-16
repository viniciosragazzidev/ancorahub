# Código de pareamento do WhatsApp que não sai (caso Edinaldo, 16/11/2026)

Status: **plano, aguardando aprovação**. Dono: Vinicios.

## O que aconteceu

O corretor Edinaldo, no roteiro "Conectar WhatsApp e confirmar presença", viu
"Não consegui gerar o código agora. Confira a internet do celular". O celular tinha internet.

O que o banco mostra (leitura, 16/11):

| Hora (Brasília) | Evento |
|---|---|
| 08:38 a 08:44 | 7 códigos de pareamento gerados com sucesso (`whatsapp.pairing_code.requested`), um por minuto |
| nenhuma | nenhum dos 7 conectou o WhatsApp |
| 09:06 | a sessão dele (`waha_9194a79bf2362da8`) ficou com status `error` (FAILED no WAHA) |
| 09:03 a 09:06 | o print: o pedido de código já falhava |

## Causas

1. **A sessão quebrada é reaproveitada.** Depois de várias trocas de código sem leitura, o WAHA põe a sessão em
   FAILED. Ao reabrir o roteiro, `runStart({ forceNew: false })` reaproveita a sessão (é idempotente) e o pedido de
   código numa sessão FAILED dá erro. A renovação automática (`forceNew`) só acontece dentro de uma tentativa em
   andamento e no máximo 2 vezes (`MAX_AUTO_RESTARTS`), então quem volta depois fica preso.
2. **A tela esconde o motivo real.** `generatePairingCode` monta a causa ("Confira o número", "servidor não aceita
   código", "demorou", erro do WAHA), mas o roteiro de presença troca tudo pela mesma frase genérica
   (`COPY.errors.issue`, "Confira a internet do celular"). O corretor procura um problema que não existe.
3. **A falha não fica registrada.** Só o sucesso vira auditoria. Quando o código falha, não sabemos o porquê
   (nem o status do WAHA, nem a mensagem), então cada caso vira investigação na mão.
4. **Por que os 7 códigos não conectaram (a confirmar).** As hipóteses, da mais provável:
   número digitado diferente do WhatsApp do celular (o código só vale para aquele número), o código digitado
   depois de vencer (vale cerca de 1 min), ou o WhatsApp do celular com o limite de aparelhos conectados.
   Hoje não registramos nada que separe esses casos.

## Plano

### Etapa 1. Sessão quebrada se recria sozinha (corrige o caso do Edinaldo)
- Ao abrir o roteiro, se a conexão está `error` (ou o WAHA responde FAILED/STOPPED), começar com
  `forceNew: true` em vez de reaproveitar a sessão.
- No pedido de código: se a resposta indicar sessão FAILED/STOPPED ou sem sessão válida, recriar a sessão uma
  vez (`forceNew`) e pedir o código de novo, sem o corretor perceber.
- `MAX_AUTO_RESTARTS` passa a contar por abertura do roteiro, não pela vida do componente.

### Etapa 2. A tela diz a causa certa
- `COPY.errors.issue` deixa de ser genérico: o roteiro usa a causa que `generatePairingCode` já monta
  (`codeIssue`), com textos novos por caso:
  - sessão recriada e ainda falhou: "O WhatsApp do servidor está instável. Tente de novo em 1 minuto."
  - número inválido: "Confira o número: DDD + celular." com o atalho "Corrigir o número".
  - servidor sem suporte a código: "Use o QR Code por enquanto." com o botão para trocar de método.
  - demorou: "O WhatsApp demorou para liberar o código. Tente de novo."
- "Confira a internet" só quando o próprio navegador falhou ao falar com o nosso servidor (fetch/rede).
- Depois de 2 falhas seguidas, oferecer "Usar o QR Code" (que não depende do número).

### Etapa 3. Registrar a falha
- Auditoria `whatsapp.pairing_code.failed` com: código do erro, status do WAHA, mensagem do servidor (sem dado
  pessoal), e os 4 últimos dígitos do número usado.
- Auditoria `whatsapp.pairing.stalled` quando um código sai e a sessão não conecta em 90 s, para medir o caso
  "códigos gerados que nunca conectam" (causa 4).
- Na tela do diretor (Equipe › WhatsApp do corretor), mostrar a última falha e o horário, com "Recriar conexão".

### Etapa 4. Ajuda quando o código não conecta
- Depois de 2 códigos sem conectar, a tela mostra o número usado ("Seu celular é (21) 9…-7185?") e pergunta se
  é o mesmo do WhatsApp do celular, antes de gerar o terceiro.
- Dica do limite de aparelhos: "Se o WhatsApp disser que não dá para conectar, remova um aparelho antigo em
  Dispositivos conectados."

### Etapa 5. Laboratório
- Entrar em `/dev/laboratorio` o fluxo "Conectar WhatsApp" com o servidor simulado respondendo: código ok,
  sessão FAILED (recria sozinho), número inválido, servidor sem código e código que não conecta. Assim dá para
  testar cada tela sem quebrar uma sessão de verdade.

## Agora, para o Edinaldo

Enquanto as etapas não saem: recriar a sessão dele (o mesmo que "Gerar novo QR" faz) deixa o próximo código sair.
Depois ele deve conferir se o número no roteiro é o do WhatsApp do celular dele e digitar o código em até 1 minuto.

## Arquivos

- `src/components/whatsapp/whatsapp-connect-dialog.tsx` (abertura com sessão em erro, retry com `forceNew`,
  contagem por abertura)
- `src/app/(dashboard)/settings/whatsapp-actions.ts` (códigos de erro do pedido, auditoria de falha)
- `src/components/chat/presence-guide/presence-guide.tsx` e `src/features/waha-cadence/pairing-copy.ts` (textos
  por causa)
- `src/app/dev/laboratorio/` (fluxo novo)
- Testes: `presence-guide.test.tsx`, `whatsapp-connect-dialog` e as ações.
