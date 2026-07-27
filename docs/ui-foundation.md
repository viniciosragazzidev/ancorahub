# Fundação obrigatória de UI e Motion

## Fontes e precedência

1. `DESIGN.md` define a identidade, os tokens, a acessibilidade e a experiência do
   CorreTop.
2. O MCP do shadcn, configurado em `.vscode/mcp.json`, e os componentes em
   `src/components/ui/` são obrigatórios para qualquer primitivo de interface.
3. `dashboard-01`, instalado pelo shadcn CLI, é a base obrigatória de shell, sidebar,
   cabeçalho, cards, tabela e gráficos para dashboards do produto.
4. [Unlumen UI](https://ui.unlumen.com/docs) é a referência de componentes polidos e
   animados, compatível com o ecossistema shadcn.
5. `.agents/skills/transitions-dev` é obrigatório para toda transição nova.

Em conflito, a regra mais acima vence. Unlumen e shadcn aceleram a implementação; não
substituem os requisitos de segurança, o design ou as regras de negócio do produto.

## Política de componentes

- Componentes reutilizáveis são obrigatórios. As fontes são `src/components/ui/` e
  `src/components/unlumen-ui/`; uma página
  só pode compor esses componentes e aplicar layout exclusivo. Não criar na página uma
  segunda versão de botão, input, card, badge, tabela, tipografia ou feedback que já
  existe ou deveria existir como primitivo.
- Use tokens centralizados para fonte, espaço, tamanho, raio, cor, borda, elevação e
  estado. Se uma tela precisar de algo novo, adicione uma variante documentada ao
  componente compartilhado em vez de repetir classes/valores arbitrários.
- Pesquise primeiro no MCP do shadcn e na documentação do Unlumen antes de criar um
  componente primitivo do zero.
- Para dashboards, use `dashboard-01` como estrutura inicial e refatore seus
  componentes para o domínio CorreTop. Não replique o template genérico em paralelo.
- Adicione somente o componente necessário à tarefa atual. Unlumen usa o mesmo fluxo
  do shadcn para copiar componentes ao código do projeto; não importar catálogo inteiro.
- Antes da primeira adição, inicialize o projeto shadcn conscientemente e revise os
  arquivos/dependências propostos. Não execute essa inicialização como efeito colateral
  de uma tarefa visual.
- Componentes devem receber tokens do CorreTop e passar por estados de acessibilidade,
  loading, erro, vazio e permissão quando aplicável.
- Componentes Pro do Unlumen exigem licença; nunca registrar chave em arquivos
  versionados. Componentes gratuitos não exigem autenticação.

## Política de motion

- Antes de criar ou modificar movimento, consulte a skill `transitions-dev` e escolha
  o padrão com melhor correspondência (dropdown, modal, panel, skeleton, tabs, tooltip,
  sucesso, erro etc.).
- Utilize a escala de motion da skill (`--duration-*`, `--ease-*`, `--distance-*`) em
  vez de durações ou curvas arbitrárias.
- Preserve o bloco `prefers-reduced-motion` da referência. Motion não pode ser a única
  forma de comunicar resultado, urgência, erro ou mudança de estado.
- Não usar movimento decorativo em filas de leads, tabelas, números financeiros ou
  dados sensíveis. Priorizar resposta imediata e leitura estável.

## Fluxo obrigatório por tarefa visual

1. Confirmar o requisito e os estados do componente.
2. Verificar `src/components/ui/`, `src/components/unlumen-ui/` e reutilizar/evoluir o componente-base antes de escrever
   qualquer estilo local de controle.
3. Consultar o MCP do shadcn; consultar Unlumen quando o caso exigir componente ou
   interação animada.
4. Verificar aderência a `DESIGN.md` e acessibilidade.
5. Quando houver motion, aplicar `transitions-dev` com a alternativa menos intrusiva.
6. Revisar keyboard/foco, `prefers-reduced-motion` e os estados assíncronos antes de
   concluir.
