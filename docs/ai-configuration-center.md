# Centro de configurações de IA

O CorreTop separa duas superfícies: **Atendimento inteligente**, em Configurações e editável pelo Diretor para o próprio tenant, e **Painel técnico**, em `/super-admin/settings`, restrito ao Super-admin/Super-dev para provedor, modelo, credenciais, prompt técnico e ativação global.

A camada da corretora usa `ai_qualification_configs`, valida todos os campos no servidor, incrementa `version` e registra alterações em `audit_logs`. O tenant vem da sessão; nenhum identificador enviado pelo navegador define o escopo. A capacidade global continua reversível pelo Super-admin.

Fluxos visuais, perguntas editáveis, RAG, simulador, versões com rollback, A/B e métricas ficam como próximas etapas, sem expor detalhes técnicos na área da empresa.
