# Protocolo de Execução

1. **Intake:** declarar objetivo, risco, domínio e critério de aceite.
2. **Descoberta:** executar `agent:context`; localizar contratos e testes próximos.
3. **Plano:** listar passos reversíveis, arquivos esperados e validações.
4. **Ciclo limitado:** alterar uma unidade coesa, executar verificação rápida e corrigir somente o que a evidência demonstrar.
5. **Gate:** executar verificação completa, registrar resultado e atualizar documentos.
6. **Encerramento:** reportar resultado, validações, riscos remanescentes e rollback.

O loop encerra quando os critérios de aceite são satisfeitos ou quando houver bloqueio objetivo. Repetir a mesma tentativa sem nova hipótese é proibido.
