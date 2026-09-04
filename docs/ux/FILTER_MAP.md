# Mapa Canônico de Filtros — Âncora CRM

**Data:** 2026-09-04  
**Etapa:** UX-1A (Auditoria)  

---

## 1. Princípios de Filtros e Busca

1. **Sem Sobrecarga Horizontal:** Nunca dispor 8 selects abertos na barra superior.
2. **Camadas de Filtragem:**
   - **Camada 1 (Sempre Visível - FilterBar):** Campo de busca textual com debounce + 1 a 2 filtros rápidos de alta frequência (ex: Status, Unidade) + Botão `+ Filtros`.
   - **Camada 2 (Avançada sob Demanda):** Sheet (mobile) ou Popover (desktop) contendo filtros secundários (Data personalizada, Corretor, Origem/Campanha, Score IA).
   - **Camada 3 (Feedback Ativo - ActiveFilterChips):** Linha de chips horizontais logo abaixo da barra, mostrando exatamente os filtros aplicados com `X` individual e botão `Limpar filtros`.

---

## 2. Mapa de Filtros por Rota

| Rota | Busca Rápida | Filtros Rápidos (Barra) | Filtros Avançados (Sheet/Popover) | Chips Ativos Suportados |
|---|---|---|---|---|
| `/leads` | Nome, Telefone, Produto, CPF | `Status`, `Unidade` | Origem da Campanha, Corretor Responsável, Faixa de Valor, Status de Qualificação IA, Período de Entrada | `Status: Em Atendimento`, `Unidade: SP Centro`, `Origem: Meta Ads`, `Corretor: João` |
| `/minha-fila` | Nome, Telefone | `Status do Atendimento` | Tipo de Produto, SLA em Risco | `Status: Novo`, `SLA: Crítico` |
| `/conversas` | Nome, Telefone, Trecho de Mensagem | `Canal / Número`, `Não Lidas` | Corretor Atribuído, Data da Última Mensagem, Status do Lead | `Canal: WhatsApp Principal`, `Somente Não Lidas` |
| `/equipe` | Nome, E-mail | `Cargo`, `Unidade` | Status de Convite (Ativo/Pendente), Disponibilidade (Online/Pausado) | `Cargo: Corretor`, `Unidade: Matriz` |
| `/relatorios` | Não aplicável | `Período (7, 14, 30, 90 dias)` | Unidade, Corretor (nas abas correspondentes) | `Período: Últimos 30 dias` |
| `/distribuicao` | Nome do Corretor | `Status do Plantão` | Filas Ativas, Tipo de Produto | `Plantão: Ativo` |

---

## 3. Comportamento Responsivo dos Filtros

- **Desktop (>= 1024px):** `FilterBar` inline com busca flex-1, dropdowns rápidos e botão `+ Filtros` que abre Popover suspenso.
- **Mobile (< 768px):** Input de busca com botão de filtro em ícone; ao clicar, abre uma `BottomSheet` acessível em tela cheia para seleção com botões `Limpar` e `Aplicar`.
