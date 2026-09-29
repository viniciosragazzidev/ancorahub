# Mapa Canônico de Ações — Âncora CRM

**Data:** 2026-09-04  
**Etapa:** UX-1A (Auditoria)  

---

## 1. Hierarquia Canônica de Ações

Toda tela ou contexto do sistema divide suas ações estritamente em quatro níveis hierárquicos:

```
1. AÇÃO PRIMÁRIA (Primary)
   - Cor sólida / Destaque visual (bg-primary text-primary-foreground)
   - Exatamente 1 por contexto
   - Exemplo: [+ Novo lead], [Enviar mensagem], [Salvar alterações]

2. AÇÕES SECUNDÁRIAS (Secondary / More Actions)
   - Botão variante outline/ghost ou agrupadas no menu `•••`
   - Exemplos: [Importar], [Exportar], [Configurar colunas]

3. AÇÕES CONTEXTUAIS (RowActions / SelectionToolbar)
   - Vinculadas a um registro específico ou a itens selecionados
   - Exemplos: [Abrir], [Criar tarefa], [Reatribuir selecionados]

4. AÇÕES DESTRUTIVAS (Danger / Destructive)
   - Identificadas semanticamente em vermelho (text-destructive)
   - Requerem diálogo de confirmação explícito (`ConfirmDialog`)
   - Exemplos: [Excluir lead], [Desconectar WhatsApp], [Revogar acesso]
```

---

## 2. Mapa de Ações por Rota Principal

| Rota | Ação Primária | Ações Secundárias (`•••`) | Ações de Linha (`RowActions`) | Ação Destrutiva |
|---|---|---|---|---|
| `/leads` | `+ Novo lead` | Importar CSV, Exportar Base, Configurações de Funil | Abrir, Iniciar WhatsApp, Agendar Tarefa, Alterar Responsável | Excluir Lead |
| `/minha-fila` | `Atender Próximo` | Filtrar por Status, Alternar Visualização | Aceitar Lead, Abrir Chat, Marcar Perdido | Recusar Lead |
| `/conversas` | `Enviar Mensagem` | Enviar Template Meta, Anexar Documento, Buscar no Histórico | Concluir Atendimento, Transferir, Criar Tarefa | Bloquear / Denunciar |
| `/distribuicao` | `+ Nova Regra` | Exportar Histórico de Roleta, Configurar Transbordo | Editar Regra, Pausar Roleta, Ajustar Peso | Excluir Regra |
| `/qualificacao` | `Sincronizar Templates` | Recarregar do Meta Graph API, Ver Logs do Agente | Editar e Recriar na Meta, Testar no Simulador | Desativar Agente |
| `/equipe` | `+ Convidar Membro` | Exportar Lista, Reenviar Convites Pendentes | Editar Cargo, Ajustar Unidade, Redefinir Senha | Desativar / Remover Membro |
| `/relatorios` | `Selecionar Período` | Exportar Relatório Consolidado, Agendar Envio | Drilldown por Corretor / Unidade | Não aplicável |
| `/settings/whatsapp` | `+ Conectar Novo Número` | Testar Conexão, Atualizar Webhooks | Configurar 2FA, Reautenticar, Baixar QR Code | Desconectar Canal |
