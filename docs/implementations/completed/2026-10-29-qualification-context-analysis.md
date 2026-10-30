# Análise contextual assistida na qualificação

**Status:** concluído  
**Decisão:** DEC-164  
**Data:** 2026-10-30

## Objetivo e limites

Antes da resposta determinística da qualificação, interpretar as últimas 12 mensagens, a pergunta pendente e a memória para preencher fatos não capturados por regex e aplicar correções que o cliente declarou explicitamente. O modelo não escreve respostas nem escolhe etapas, prioridade de perguntas, temperatura, distribuição ou handoff.

## Regras aprovadas

- Groq/OpenRouter pelo `createAiRouter`; saída JSON validada por Zod.
- Para substituir campo confirmado, a mensagem atual precisa trazer termo explícito de correção e o modelo precisa listar o campo em corrections; a lista sozinha não basta. Campo não confirmado pode receber valor novo quando as regras o validarem.
- Nenhum fato confirmado é removido por ausência. A extração determinística continua como fallback e salvaguarda de negações.
- Timeout total de até seis segundos; falha, JSON inválido ou configuração ausente preserva a memória determinística.
- Em 2026-10-30, Vinicios confirmou a análise ligada em todas as filas, com envio das conversas redigidas aos provedores Groq/OpenRouter. O Super-admin desliga por empresa em `qualification_context_analysis_<tenantId>` ou por fila em `qualification_context_analysis_<tenantId>_<queueId>`; empresa desligada prevalece. Fila com `aiQualificationEnabled=false` nunca chama o analisador.
- Logs de uso guardam provedor/modelo, tokens, estado e apenas nomes de campos/intensões, sem mensagem, telefone ou valores de qualificação.

## Dados enviados ao provedor

O gateway escolhe Groq ou OpenRouter pelas chaves, ordem e modelo configurados para o tenant. O payload de cliente enviado em cada caminho ativo é:

- **Análise contextual:** instruções fixas de sistema, até as últimas 12 mensagens da conversa (incluindo a atual), pergunta pendente e memória de qualificação (planType, companyHasCnpj, numberOfLives, ages, city, currentPlan, lastQuestionAsked e collectedFields), com saída JSON e parâmetros técnicos do modelo.
- **Fallback interpretativo:** instruções de intenção, até as últimas 12 mensagens, pergunta do campo pendente e memória textual atual. A classificação do lead pode incluir o tipo; o nome é enviado como [NOME].
- **Verificação de fatos:** instruções fixas, mensagem inbound atual, pergunta pendente e fatos estruturados que as regras extraíram (idade, número de vidas ou tipo de plano), somente quando há fato extraído e a mensagem é longa ou contém mais de um número.
- **Resposta lateral:** pergunta atual redigida, instruções fixas e contexto comercial/roteiros configurados pelo tenant; o campo de nome do cliente é omitido ou enviado como [NOME].

Antes do envio, telefone, e-mail, CPF, CNPJ, nome completo/primeiro nome do lead, endereço em rua, avenida, alameda, travessa, estrada, praça, rodovia, largo, beco, viela ou servidão (incluindo r., av., al., tv., est., pc. e rod.), com ou sem número, e CEP são substituídos por [TELEFONE], [E-MAIL], [CPF], [CNPJ], [NOME], [ENDEREÇO] e [CEP]. Cidade e bairro permanecem para qualificação. Nomes de terceiros, como marido e filhos, não são redigidos. O corpo dos prompts não inclui IDs internos do lead ou da conversa; esses IDs podem seguir como metadados operacionais do gateway. Base legal/contrato com provedores: (a confirmar).
## Implementação realizada

1. Análise contextual estruturada criada com parser Zod, merge protegido, fallback e timeout total de seis segundos. Redação de dados pessoais aplicada antes de montar os payloads do analisador, fallback, verificador e resposta lateral.
2. Integração depois das proteções existentes e antes da decisão determinística; o modelo não decide handoff, etapa nem texto da resposta.
3. Controles auditados disponíveis no Super-admin por empresa e fila, mantendo `aiQualificationEnabled=false` como bloqueio absoluto.
4. DEC-164, termo de domínio, funcionalidade, dados enviados ao provedor e evidências de validação registrados.

## Arquivos e validações

Arquivos centrais: context-analysis.ts, qualification-context-analysis-settings.ts, conversation-state-machine.ts, qualification-interpreter.ts, lateral-answer.ts, model-router.ts, ai-usage-log.ts e as ações/tela do Super-admin. Na revisão de privacidade de 2026-10-30, a redação foi ampliada e o prazo total passou a cobrir a leitura do corpo da resposta HTTP. Vitest focado: 40 arquivos, 400 testes aprovados. npx tsc --noEmit -p . aprovado. ESLint dos arquivos alterados: zero erros e 8 avisos legados fora dos trechos adicionados. agent:docs aprovado; arquitetura e desempenho apontaram apenas os arquivos grandes já existentes, e a fronteira tenantId sinalizada pelo diagnóstico foi revisada: ações exigem Super-admin e validam UUID/empresa, e a ação por fila confere o vínculo tenant-fila.

Sem migrations, testes de banco ou leitura de `.env.local`.

## Riscos e rollback

O interpretador pode sugerir valor incorreto ou atrasar a resposta. O merge exige evidência e confiança, exige termo de correção ou novo valor para o mesmo campo, e usa fallback automático após seis segundos. Desligar a chave por empresa ou fila remove a chamada; remover a integração restaura imediatamente o fluxo determinístico.
