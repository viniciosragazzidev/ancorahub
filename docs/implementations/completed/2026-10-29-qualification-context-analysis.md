# Análise contextual assistida na qualificação

**Status:** concluído  
**Decisão:** DEC-164  
**Data:** 2026-10-29

## Objetivo e limites

Antes da resposta determinística da qualificação, interpretar as últimas 12 mensagens, a pergunta pendente e a memória para preencher fatos não capturados por regex e aplicar correções que o cliente declarou explicitamente. O modelo não escreve respostas nem escolhe etapas, prioridade de perguntas, temperatura, distribuição ou handoff.

## Regras aprovadas

- Groq/OpenRouter pelo `createAiRouter`; saída JSON validada por Zod.
- Confiança mínima, evidência textual e lista explícita de campo corrigido antes de substituir dado existente.
- Nenhum fato confirmado é removido por ausência. A extração determinística continua como fallback e salvaguarda de negações.
- Timeout total de até seis segundos; falha, JSON inválido ou configuração ausente preserva a memória determinística.
- Ligado por padrão. O Super-admin desliga por empresa em `qualification_context_analysis_<tenantId>` ou por fila em `qualification_context_analysis_<tenantId>_<queueId>`; empresa desligada prevalece. Fila com `aiQualificationEnabled=false` nunca chama o analisador.
- Logs de uso guardam provedor/modelo, tokens, estado e apenas nomes de campos/intensões, sem mensagem, telefone ou valores de qualificação.

## Implementação realizada

1. Análise contextual estruturada criada com parser Zod, merge protegido, fallback e timeout total de seis segundos.
2. Integração depois das proteções existentes e antes da decisão determinística; o modelo não decide handoff, etapa nem texto da resposta.
3. Controles auditados disponíveis no Super-admin por empresa e fila, mantendo `aiQualificationEnabled=false` como bloqueio absoluto.
4. DEC-164, termo de domínio, funcionalidade e evidências de validação registrados.

## Arquivos e validações

Arquivos centrais: `context-analysis.ts`, `qualification-context-analysis-settings.ts`, `conversation-state-machine.ts`, `model-router.ts`, `ai-usage-log.ts` e as ações/tela do Super-admin. `vitest` focado: 40 arquivos, 391 testes aprovados. `npx tsc --noEmit -p .` aprovado. ESLint dos arquivos alterados: zero erros e 10 avisos em código legado fora dos trechos adicionados. `agent:docs` aprovado; arquitetura e desempenho apontaram apenas os arquivos grandes já existentes, e a fronteira `tenantId` sinalizada pelo diagnóstico foi revisada: ações exigem Super-admin e validam UUID/empresa, e a ação por fila confere o vínculo tenant-fila.

Sem migrations, testes de banco ou leitura de `.env.local`.

## Riscos e rollback

O interpretador pode sugerir valor incorreto ou atrasar a resposta. O merge exige evidência e confiança, limita correção a texto explícito, e usa fallback automático após seis segundos. Desligar a chave por empresa ou fila remove a chamada; remover a integração restaura imediatamente o fluxo determinístico.
