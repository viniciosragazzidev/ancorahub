# Contrato de Redesign

**Status:** vigente

## Objetivo

Tornar o CRM mais claro, leve e organizado sem alterar regras de negócio,
autorizações, distribuição, SLA, webhooks, processamento de Meta/WAHA ou dados.

## Filosofia

1. A próxima decisão vem antes de dados, controles e decoração.
2. Cada contexto possui uma ação principal visível; ações ocasionais ficam em menus
   contextuais e ações avançadas aparecem somente quando necessárias.
3. A interface revela complexidade progressivamente: conteúdo essencial primeiro,
   detalhes em tabs, accordions, drawers, menus ou filtros avançados quando isso
   reduz carga cognitiva.
4. Uma capacidade tem uma Home canônica. Configurações auxiliares apontam para essa
   Home e não reproduzem o mesmo fluxo em lugares diferentes.
5. Dados reais, permissão, escopo de tenant, unidade, equipe e carteira continuam
   sendo definidos no servidor. A camada visual não é autoridade de negócio.
6. Refinar e reutilizar componentes compartilhados antes de criar novos controles.

## Hierarquia de informação

- **Primário:** decisão ou ação frequente do contexto; fica sempre visível.
- **Secundário:** suporte recorrente; pode ficar na toolbar ou aba contextual.
- **Contextual:** depende de linha, seleção ou estado; fica junto do objeto.
- **Avançado:** baixa frequência ou alta densidade; fica em `+ Filtros`, accordion,
  drawer ou menu `•••`.
- **Destrutivo:** requer contexto claro, confirmação proporcional e auditoria quando
  aplicável.
- **Redundante, legado ou ruído técnico:** não recebe destaque; deve ser removido ou
  consolidado em uma etapa registrada.

## Padrões de composição

- Listas operacionais: contexto, uma ação principal, busca/filtros essenciais,
  tabela ou lista e ações por linha em menu contextual.
- Detalhes: resumo essencial primeiro; grupos funcionais em tabs; dados raros em
  accordion ou drawer.
- Conversas: lista, conversa e painel contextual recolhível; não duplicar a mesma
  informação nos três painéis.
- Configurações: mostrar a consequência antes do controle; parâmetros dependentes
  só aparecem quando a capacidade correspondente está ativa.
- Dashboard: poucos indicadores acionáveis; nenhum card decorativo, métrica fixa ou
  duplicação de dashboard.

## Qualidade obrigatória

- Usar componentes compartilhados existentes em `src/components/ui/` e
  `src/components/unlumen-ui/` quando cobrirem a necessidade.
- Não institucionalizar novos tokens, primitives ou variantes sem justificar o gap
  no registro da etapa atual.
- Cobrir carregamento, vazio, erro, sucesso, indisponibilidade e permissão quando
  relevantes.
- Garantir semântica, teclado, foco visível, contraste, zoom, viewport estreito e
  `prefers-reduced-motion`.
- Preservar URL para filtros, abas e contexto quando isso ajudar retorno, suporte ou
  compartilhamento.

## Sequência obrigatória

`UX-1A Auditoria` → `UX-1B Foundations e componentes` → `UX-1C Navegação` →
`UX-1D Dashboard` → `UX-1E Leads` → `UX-1F Detalhe do lead` →
`UX-1G Conversas` → `UX-1H Equipe` → `UX-1I Configurações e integrações` →
`UX-1J Mobile, acessibilidade e limpeza`.

Nenhuma etapa posterior pode começar sem os critérios de saída da anterior no
[Controle de Execução](./UX_REDESIGN_CONTROL.md).
