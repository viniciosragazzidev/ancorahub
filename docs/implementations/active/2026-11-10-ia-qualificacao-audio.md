# IA de qualificação entende áudio (2 primeiros, só em qualificação)

Branch: `feat/ia-qualificacao-audio` (cortada de `origin/feat/diretor-visual-lite`). Sem merge nem push até a revisão.

Pedido: "adicione a capacidade da ia entender audio limitado a somente ao lead em qualificação e os dois primeiros audios deles".

## Como funciona hoje (mapeamento)

- **Chegada do áudio**
  - WAHA: `src/features/waha-cadence/inbound.ts` grava a mensagem com `body = "[audio]"` (de `contract.ts`) e, antes do insert, baixa o arquivo pelo relay e guarda no R2 (`storeWahaMessageMedia` → `whatsapp_messages.media_storage_key`). A IA só roda para números da empresa (`source.kind === "number"`) com `WAHA_AI_FEATURE` ligada.
  - Meta: `src/features/communication-channels/service.ts` baixa a mídia da Graph API (`downloadMetaMediaObject`), guarda no R2 e grava `body = "[audio]"`. A IA roda quando `shouldStartOrResumeAiQualification` (pending/qualifying) ou lead distribuído com fluxo parcial; para qualificado roda só em modo correção.
  - A tela mostra "[audio]" como "Áudio indisponível" (`media-kinds.ts`) quando não há arquivo, ou o player (`media-bubble.tsx`) quando há.
- **Como a IA lê**: `processInboundAiTurn` (`conversation-state-machine.ts`) recebe `userMessageBody = "[audio]"`, troca por "O cliente enviou um áudio." e trata como anexo (quick reply `media.received` ou reenvio da pergunta). Histórico, rajada (debounce de 8 s), extração de campos e análise de conversa leem `whatsapp_messages.body`.
- **"Em qualificação"**: já existe a regra `isUnansweredRecoveryStateEligible` (conversa `AI_ACTIVE`/`WAITING_CUSTOMER`, automação `AI_ACTIVE`, lead `pending`/`qualifying`, fora de `manual_hold`). Uso a mesma ideia, aceitando também a conversa `NEW` do primeiro contato.
- **Transcrição existente**: nenhuma. Há leitura de imagem/PDF (`features/ai/vision.ts`), e a ElevenLabs só aparece fora do runtime (vídeo de boas-vindas).

## Serviço de transcrição

| Opção | Custo aprox. (tabela pública, conferir) | Privacidade | Encaixe no projeto |
|---|---|---|---|
| **Groq `whisper-large-v3-turbo`** (recomendado) | US$ 0,04/hora (mín. 10 s por chamada) ≈ R$ 0,004 por áudio de 1 min | Não usa dados para treino (política de retenção a conferir no contrato) | Já é o provedor principal (`GROQ_API_KEY` e chave por empresa); API compatível com OpenAI, usa `transcribe` do AI SDK |
| OpenAI `gpt-4o-mini-transcribe` (reserva automática) | US$ 0,003/min = US$ 0,18/h | Não treina com dados da API; guarda até 30 dias para abuso | `OPENAI_API_KEY` já existe |
| ElevenLabs `scribe_v1` | ≈ US$ 0,22–0,40/h, consome créditos do plano | Retenção zero só no Enterprise | Chave e SDK novos no servidor |

Decidido (recomendado): Groq, com OpenAI como reserva quando não houver chave Groq. Whisper em pt-BR (`language: "pt"`), temperatura 0.

## Decisões (todas na opção recomendada)

1. **Limite e checagem no servidor, com contagem gravada.** Tabela nova `lead_audio_transcriptions` (migração `0225`): uma linha por áudio considerado, com `slot` 1 ou 2 único por lead (`unique(tenant_id, lead_id, slot)`) e `unique(tenant_id, provider_message_id)` para idempotência. Dois áudios ao mesmo tempo não passam do limite. O slot só é gasto quando o áudio vai ao provedor; áudio longo demais ou sem arquivo não gasta.
2. **Duração máxima: 2 minutos.** Lida do próprio arquivo OGG/Opus (nota de voz do WhatsApp) antes de enviar; para outros formatos, teto de 2 MB.
3. **Fora do limite, longo demais ou falha**: a IA não transcreve e responde com gentileza pedindo texto (uma mensagem curta, sem repetir se a última mensagem da IA já foi esse pedido). O fluxo de qualificação continua na próxima mensagem escrita.
4. **Transcrição visível para corretor e gestor**: o texto vai para o `body` da mensagem de áudio, então a IA, o histórico, a rajada e a análise de conversa leem como texto sem mexer em cada consulta. Na conversa aparece embaixo do player com o rótulo "Transcrição".
5. **Flag por empresa, desligada por padrão**: `feature_ai_audio_transcription_<tenantId>`, ligada/desligada pelo Super-admin na página da empresa (mesmo padrão do lembrete de plantão), sem deploy.
6. **Custo e uso**: cada chamada fica em `ai_attendance_logs` (`provider = "audio_transcription"`, custo estimado pela duração) e na própria tabela (status, duração, modelo, custo).

Leads fora da qualificação (com corretor, qualificados, frios, pós-venda) seguem exatamente como hoje.

## Componentes

- `drizzle/0225_lead_audio_transcriptions.sql` + entrada no journal + `schema.ts`.
- `src/features/ai-agent/audio-transcription/rules.ts` (puro): elegibilidade, duração OGG, custo, textos de pedido para escrever.
- `src/features/ai-agent/audio-transcription/service.ts`: flag, slot, download do R2, transcrição, gravação do texto, log.
- `conversation-state-machine.ts`: um bloco no início do turno (transcreve e segue como texto) e um retorno curto para o pedido de escrever.
- `media-bubble.tsx`: rótulo "Transcrição" sob o player.
- Super-admin: ação e botão Ligar/Desligar.

## Antes do deploy

- Rodar `npm run db:migrate` a partir desta branch (precisa imprimir `Applied 0225_lead_audio_transcriptions.sql`). Sem a tabela, a transcrição fica desligada sozinha (o áudio segue como hoje).
- Ligar a flag só na empresa piloto.
