# Mapa de Autoridade de Configurações — Âncora CRM

**Data:** 2026-09-04  
**Etapa:** UX-1A (Auditoria)  

---

## 1. Princípio da Home Canônica de Configuração

Cada capacidade técnica ou de negócio possui **apenas UMA tela canônica de gestão**. Configurações secundárias, atalhos em menus ou drawers apontam diretamente para essa tela por deep link, sem reproduzir formulários duplicados em outros locais.

---

## 2. Mapa de Autoridades por Domínio

| Domínio de Configuração | Rota Canônica de Autoridade | Responsável / Papel Autorizado | Sub-recursos Governados |
|---|---|---|---|
| **Canais de Comunicação (WhatsApp & WAHA)** | `/settings/whatsapp` e `/settings/waha-diagnostic` | Super-Admin / Diretor | Meta Cloud API App Credentials, Webhook Token, WABA ID, Telefones Cadastrados, Instâncias WAHA VPS, Diagnóstico de Conexão. |
| **Templates WhatsApp Meta** | `/qualificacao?tab=meta_templates` | Super-Admin / Diretor | Sincronização com Meta Graph API, Validação de Variáveis Posicionais, Edição e Recriação em Nova WABA, Associação com Acontecimentos de Negócio. |
| **Robô de Qualificação & IA** | `/qualificacao` | Super-Admin / Diretor | Modelo de IA, Prompt do Sistema, Playbooks Situacionais, Thresholds de Confiança, Simulador Interativo. |
| **Regras de Distribuição & Roletas** | `/distribuicao` | Super-Admin / Diretor / Gerente | Roleta por Unidade, Capacidade Máxima de Leads por Corretor, Regras de Transbordo, Horário de Plantão. |
| **Estrutura de Equipe & Permissões** | `/equipe` e `/equipe/cargos` | Super-Admin / Diretor | Cadastro de Membros, Atribuição de Cargos, Matriz de Capabilities (RBAC), Custom Roles por Tenant. |
| **Unidades & Filiais** | `/filiais` e `/unidades/[branchId]` | Super-Admin / Diretor | Cadastro de Filiais, CNPJ, Endereço, Vínculo de Colaboradores por Unidade. |
| **Marketing & Meta Ads** | `/marketing/campanhas` e `/settings/meta` | Super-Admin / Diretor | Integração Meta Lead Ads, Mapeamento de Formulários Instantâneos, Roteamento por Campanha. |
| **Parâmetros Operacionais do Tenant** | `/settings` | Super-Admin / Diretor | Nome da Corretora, Logo, Fuso Horário, Horário Comercial, Políticas de Retenção e Auditoria. |

---

## 3. Padrão de Apresentação Canônica: `SettingsSection` & `SettingsToggleRow`

1. **Mostrar a consequência antes do controle:** Todo item de configuração possui título claro e descrição objetiva em linguagem humana do efeito da configuração.
2. **Dependências Condicionais:** Parâmetros dependentes ficam recolhidos ou ocultos quando a chave principal (`Toggle`) estiver desligada.
3. **Auditabilidade Obrigatória:** Toda alteração de parâmetro dispara registro no log de auditoria do Super-Admin com `userId`, `entidade`, `valor_anterior` e `novo_valor`.
