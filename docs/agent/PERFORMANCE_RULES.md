# Regras de Desempenho

- Mantenha componentes de servidor como padrão; fronteiras cliente devem ser pequenas.
- Prefira consultas paralelas independentes e selecione apenas colunas necessárias.
- Evite estado derivado em `useEffect`, renders em cascata e polling sem cancelamento.
- Reuse cache/revalidação local-first com chave contendo tenant e usuário quando houver
  dado de servidor no cliente.
- Integrações usam timeouts, idempotência, retries apenas transitórios e circuit breaker
  quando aplicável. Não bloqueie o fluxo CRM por indisponibilidade de IA.
- Arquivos grandes são sinal de extração de módulo, não um erro automático. O checker
  registra diagnóstico acima de 32 KB e toda exceção deve ter plano de divisão.
