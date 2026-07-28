# Regras de Desenvolvimento

1. Classifique a tarefa: UI, domínio, API/webhook, banco, integração, segurança ou
   manutenção. Carregue somente os módulos mapeados.
2. Antes de mudar contrato, localize RF/BR/DEC; pendência bloqueante exige decisão
   registrada.
3. Toda entrada externa usa schema no servidor. Tenant, papel, unidade e carteira vêm
   da sessão ou do canal autenticado.
4. Reutilize primitives e tokens. Em Next.js, preserve Server Components por padrão e
   leia a documentação local compatível antes de mudar rotas, Server Actions ou RSC.
5. Trabalhe em ciclos pequenos: editar, verificar, diagnosticar, corrigir e registrar.
6. Não instale dependências, não exponha segredos e não misture alterações não
   relacionadas no mesmo registro ou commit.

Novas capacidades de produto devem ter autorização server-side, auditoria, configuração
e controle reversível pelo Super-admin conforme `AI_RULES.md`.
