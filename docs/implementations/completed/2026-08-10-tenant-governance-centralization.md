# Governança por empresa no Super-admin

## Entrega

- `/super-admin/settings` ficou restrita a configurações globais e dados compartilhados da plataforma.
- A página individual `/super-admin/tenants/[tenantId]` passou a concentrar os controles da corretora: situação da licença, piloto de Facebook Lead Ads, exceção da interface operacional e piloto de cargos personalizados.
- O piloto de Lead Ads agora é encontrado em **Empresas → selecionar empresa → Pilotos e permissões**, com estado que diferencia empresa não liberada, dependência global desativada e capacidade disponível.
- A tela geral aponta para Empresas em vez de mostrar listas longas de tenants com botões de liberação.

## Segurança e reversão

- As ações individuais recebem o identificador da empresa vinculado pela rota e validam UUID, existência da empresa e papel de Super-admin no servidor.
- Cada mudança grava `platform_audit_logs`, revalida a página da empresa e pode ser revertida sem apagar dados, histórico ou integrações existentes.
- A liberação por empresa não ignora os controles globais: se o kill switch estiver desligado, a interface explica que o piloto está preparado, mas não operacional.

## Validação

- `npx tsc --noEmit --pretty false`: aprovado.
- ESLint nos arquivos alterados: sem erros; permanecem dois avisos preexistentes de aspas em texto de perfil na tela global.
- `npm run agent:verify -- --level full`: excedeu o limite de 64 segundos do ambiente sem retornar diagnóstico; a verificação focal e o type-check foram concluídos.
