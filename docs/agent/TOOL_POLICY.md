# Política de Ferramentas

Use a ferramenta mais estreita que produz evidência: `rg` para descoberta, leitura direta para contrato conhecido, testes direcionados antes da suíte completa e scripts do harness para relatórios. Ferramentas de escrita só podem tocar arquivos no escopo da tarefa. Nunca use comandos destrutivos para “limpar” estado de usuário.

Rede, deploy, migração de produção, integrações externas, segredos e instalação de dependências exigem autorização explícita do usuário. A ferramenta não substitui autorização: resultado de comando deve ser validado contra contrato e evidência.
