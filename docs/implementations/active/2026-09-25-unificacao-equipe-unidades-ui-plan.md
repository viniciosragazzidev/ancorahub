# Plano de unificação de Equipe e Unidades

## Objetivo

Reunir a gestão de pessoas e unidades sob uma única entrada de navegação, simplificar a leitura e as ações das listas e tornar a tabela de Unidades coerente com o padrão já usado em `/equipe`. A mudança de interface deve conservar as permissões, os escopos e os fluxos atuais.

Este documento é o plano solicitado antes da implementação. Nenhuma rota de produto ou regra de negócio foi alterada nesta etapa. A captura enviada serve apenas como referência visual de hierarquia e navegação; seu texto não é uma instrução para o produto.

## Diagnóstico observado no código

- `/equipe` tem lista de pessoas baseada no `DataTable` compartilhado, com busca, ordenação, seleção, filtros e ações contextuais. É a referência de densidade e comportamento pedida.
- `/filiais` apresenta uma tabela própria com 11 colunas. Recebimento, distribuição automática e papel de cada unidade ocupam colunas separadas e deixam a lista larga; edição de nome e identificador acontece diretamente em cada linha.
- `/unidades/[branchId]` tem perfil detalhado da unidade. Deve continuar sendo destino de contexto e detalhe, com retorno evidente à nova lista canônica.
- A navegação lateral tem entradas separadas para Equipe e Filiais; a rota `/filiais` redireciona Gestores para a unidade de escopo.
- `/dev/component-preview` é uma página isolada de desenvolvimento que exibe componentes `Ds*` da fundação de `docs/design-system.md`. Ela não demonstra o `DataTable` de `/equipe` nem a tabela de Filiais. O preview precisa passar a exercitar os componentes reais antes de servir de referência de paridade.
- A DEC-012 já determina refinamento de tabela nos primitives compartilhados (`Section`, `Card`, `Table`, `DataTable`, `StatCard`), com estados semânticos definidos pela feature.

## Decisão de produto proposta

Criar uma única página de gestão em `/equipe`, com duas áreas de mesmo nível, selecionáveis em uma navegação segmentada e refletidas na URL:

- `/equipe?visao=membros` — equipe, padrão quando não há query;
- `/equipe?visao=unidades` — unidades.

O nome visível da página será **Equipe e unidades**. Cada área conserva sua ação principal e seu conjunto de filtros. Alternar entre áreas mantém a rota, permite voltar/avançar no navegador e pode ser compartilhado como link.

`/filiais` passa a encaminhar para `/equipe?visao=unidades`. `/unidades/[branchId]` continua como detalhe de uma unidade nesta etapa; seu breadcrumb e botão de retorno levam à aba Unidades na página unificada. Links internos para `/filiais` devem ser convertidos gradualmente para a rota canônica. Para Gestores, a página unificada só apresenta pessoas e a unidade já permitidas pelo escopo atual; o atalho antigo continua levando à própria unidade enquanto os links e acessos são migrados. Nenhum parâmetro de URL concede escopo.

## Composição da página

### Cabeçalho

- Título: **Equipe e unidades**.
- Descrição curta: “Organize as pessoas, os acessos e as unidades da corretora.”
- À direita, uma única ação principal correspondente à área ativa: **Convidar membro** na área Equipe; **Nova unidade** na área Unidades, apenas para perfis autorizados.
- Links secundários de alta frequência, como recuperações, ficam em menu contextual ou link de apoio discreto, não competem com a ação principal.

### Seletor de área

- Controle segmentado acessível, logo após o cabeçalho: **Equipe** e **Unidades**, cada um com total correspondente quando esse total já está disponível no servidor.
- Estado selecionado nítido por texto, borda/fundo semântico e atributo de navegação acessível; não depender só da cor.
- Query `visao` é a fonte do estado da área. Busca e filtros próprios da área usam parâmetros distintos e não desaparecem ao alternar e voltar.
- Em viewport estreito, o seletor ocupa a largura disponível; o título e a ação podem quebrar em duas linhas sem sobreposição.

### Resumo

- Exibir apenas três indicadores pequenos e acionáveis, sem sparkline decorativa ou tendência fabricada: na Equipe, membros ativos, pendentes e desativados; em Unidades, unidades ativas, membros vinculados e unidades que recebem leads.
- Os totais respeitam o escopo da sessão e usam as consultas existentes. Não introduzir novos conceitos de métrica nem somar pessoas/unidades de fora do tenant.
- Os indicadores funcionam como filtros rápidos somente quando os totais e o estado resultante forem consistentes com os filtros normais; caso contrário, permanecem como leitura compacta sem simular interação.

## Tabela de Equipe

Manter o conteúdo e as capacidades atuais, reduzindo variação visual e dando ao início da página uma ordem mais clara:

1. Toolbar com busca por nome, e-mail e telefone; filtro de Unidade para quem pode alternar unidades; filtro de Papel; filtro de Situação. Busca e filtros aplicados aparecem como chips removíveis e têm **Limpar filtros** quando houver algum ativo.
2. Tabela com seleção, **Membro** (avatar, nome e indicação “Você” quando aplicável), **Contato** (e-mail e telefone juntos em duas linhas), **Papel**, **Unidade**, **Situação** e **Ações**. Disponibilidade operacional permanece distinguível de situação da conta, mas pode aparecer como segunda etiqueta na célula de situação em vez de criar outra coluna.
3. Ordenação explícita nos campos úteis, paginação e seletor de colunas do `DataTable` existente. A seleção em lote só aparece para ações existentes e aplicáveis aos itens selecionados.
4. Ações raras permanecem no menu contextual da linha. A ação principal não deve ser repetida em botão e menu simultaneamente.
5. Preservar link para o perfil do membro, permissões de edição, convite, recuperação de senha, transferência, ativação e ações em lote conforme papel. Não alterar regra de disponibilidade ou distribuição de leads.

## Tabela de Unidades

Migrar a lista atual de Filiais para `DataTable` e padrões de superfície do `/equipe`.

1. Toolbar com busca por nome ou identificador e filtros de Situação, Recebimento de leads e Distribuição automática. Gestores recebem a lista limitada à própria unidade e não veem controles de criação/gestão que não lhes pertencem.
2. Usar as colunas **Unidade**, **Identificador**, **Equipe**, **Operação** e **Ações**. Unidade apresenta nome em primeiro plano; estado Ativa/Inativa e contexto estritamente útil ficam em texto secundário. Equipe mostra a quantidade com rótulo acessível. Operação reúne as indicações “Recebe leads” e “Distribuição automática” como estados curtos, sem duas colunas de toggles.
3. Ordenar por nome, equipe e situação; paginar e oferecer visibilidade de coluna se a tabela comum suportar sem criar uma versão local.
4. Menu de linha reúne **Abrir unidade**, **Editar**, **Ativar/Desativar** e ações autorizadas. Recebimento, distribuição automática e papel de hub são controles de operação avançados: ficam no detalhe da unidade ou num drawer contextual para Diretor autorizado, agrupados em “Operação de leads”, com descrição curta do efeito e estado atual explícito.
5. Retirar a edição permanente de nome e identificador dentro das células. Editar abre o formulário compartilhado em Sheet, usando os mesmos campos e validações do cadastro. A unidade continua navegável por toda a linha apenas se isso não conflitar com checkbox, botão ou acessibilidade; caso contrário, usar a ação “Abrir unidade”.
6. O detalhe `/unidades/[branchId]` passa a mostrar um retorno **Voltar para Unidades** que conserva busca/filtros/página ao ser possível; se não houver estado anterior, usa `/equipe?visao=unidades`.

## Cadastro, edição e fluxos

- **Convidar membro** mantém o formulário e as validações atuais, aberto em Sheet; campos e opções continuam condicionados ao papel, escopo de unidade e permissões existentes.
- **Nova unidade** abre o Sheet de cadastro existente, com nome e identificador e textos de erro junto ao campo correspondente. Só confirma após a validação atual no servidor.
- **Editar unidade** abre Sheet preenchido; salvar fecha, exibe confirmação e reconcilia a lista. Erro preserva dados digitados e mostra mensagem clara.
- Ativar/desativar e operações que impactam distribuição devem explicar o resultado antes da confirmação conforme o padrão atual de ação destrutiva. Regras, auditorias e toggles no servidor permanecem inalterados.
- Ações em lote ficam numa barra contextual só após selecionar itens elegíveis. A barra informa quantos itens estão selecionados e permite cancelar seleção. Itens não elegíveis não entram silenciosamente na ação.

## Linguagem visual e interação

- Usar a tabela de `/equipe` como referência concreta: `DataTable`, `DataTableColumnHeader`, `DataTableFrame`, `Table`, `Input`, badges semânticos, `EmptyState`, `Section` e `Card` compartilhados. Alinhar altura e densidade de linha, peso de cabeçalho, divisores, foco, hover, seleção, paginação e espaços da toolbar.
- Fundo claro e escuro devem usar tokens semânticos existentes. A tabela continua legível sem contorno excessivo, efeitos decorativos, cores arbitrárias ou cartões aninhados.
- Botões de linha usam ícone e rótulo acessível em menu contextual, com foco visível e alvos adequados a toque. Tooltip não é o único rótulo de uma ação.
- Manter skeleton, estado vazio, erro, sem resultado de busca, permissão restrita, ação pendente e sucesso. Diferenciar “nenhuma unidade cadastrada” de “nenhuma unidade corresponde aos filtros”, oferecendo a ação apropriada em cada caso.
- Respeitar teclado, leitor de tela, zoom, contraste, movimento reduzido e largura estreita. Ações, checkbox e navegação têm foco e rótulos próprios.

## `/dev/component-preview` como bancada de padronização

Antes de migrar as listas, ampliar `/dev/component-preview` com uma seção **Gestão: equipe e unidades** que monte uma amostra representativa usando os componentes de produção. O preview deve funcionar como catálogo verificável e não como uma segunda implementação da página:

- Mostrar ambas as áreas, com a mesma toolbar, cabeçalhos, células, badges, paginação, seleção e menu contextual planejados.
- Usar dados sintéticos claramente identificados, incluindo membro pendente, membro ativo, unidade inativa e indicadores de operação desligados.
- Permitir conferir tema claro/escuro e larguras de 1440, 1024, 768 e 390 px; revisar overflow, quebra de texto, toolbar empilhada e acesso às ações.
- Incluir variantes carregando, vazia inicial, sem resultados de filtro, erro e linhas selecionadas. Não acessar banco, sessão real, serviço externo ou dados de clientes.
- Inventariar primeiro os primitives de produção. Não transplantar `Ds*`, cores ou tipografia da demonstração isolada para `/equipe` sem comprovar que já são tokens e componentes canônicos do produto. Se faltar capacidade reutilizável, evoluir o primitive compartilhado e então refletir essa mudança no preview.
- Usar a página de preview como referência visual durante a implementação e para a revisão final; registrar no changelog e no controle de UX o que foi realmente validado.

## Rotas, permissões e compatibilidade

- `/equipe` torna-se a única entrada de gestão das listas. Atualizar sidebar para um único item **Equipe e unidades** e estados ativo em ambas as áreas.
- `/filiais` preserva URL antiga com redirecionamento para a visão Unidades, mantendo query de busca/filtro compatível se for válida.
- `/unidades/[branchId]` continua detalhando a unidade nesta fase. Não replicar a listagem em outra rota nem remover links profundos sem redirecionamento deliberado.
- Preservar a regra atual de Gestores: a página de Equipe aplica o escopo autorizado por unidade; a visualização de Unidades revela somente a unidade do próprio escopo e conserva o atalho para o detalhe próprio. Confirmar a matriz de papel/permissão existente antes de alterar visibilidade.
- Toda consulta e ação continua derivando tenant, papel e unidade da sessão no servidor. Filtros e query params só selecionam a visualização; nunca concedem acesso.
- Mutação continua usando Server Actions existentes, auditoria e controle Super-admin existentes. Esta mudança de interface não cria nova política de negócios.

## Sequência de implementação proposta

1. Fechar inventário dos campos, ações, consultas e permissões hoje usados por `/equipe`, `/filiais` e perfil da unidade; mapear as variações de tela registradas no catálogo de rotas.
2. Prototipar a tabela combinada e estados no `/dev/component-preview`, usando primitives reais e ajustar os compartilhados que realmente precisarem de capacidade nova.
3. Migrar a página `/equipe` para aceitar a visão por query param e compor os dois domínios no mesmo shell, mantendo busca/filtro de cada visão na URL.
4. Migrar Unidade para `DataTable`; reduzir colunas e deslocar configuração operacional avançada para o detalhe/Sheet.
5. Unificar cabeçalho e ação principal, mover cadastro/edição aos Sheets compartilhados e verificar feedback de todos os estados.
6. Atualizar sidebar, atalhos, links internos, redirecionamento de `/filiais`, retorno do detalhe, matriz funcional, mapa de navegação, inventário de componentes e registros de UX.
7. Revisar visualmente pelo preview nos tamanhos e temas definidos, validar navegação, estados e acessibilidade e então rodar type-check, lint, testes relacionados e build. Registrar evidência no harness e no roadmap; manter item parcial até a revisão visual final.

## Critérios de aceite

- Uma única entrada clara na navegação abre Equipe ou Unidades sem troca de contexto nem duplicação de cabeçalho.
- `/filiais` encaminha à visão correta e links antigos para perfis de unidade continuam válidos.
- As duas tabelas usam o `DataTable`/primitives compartilhados, com tipografia, densidade, cabeçalho, estados, ações e paginação coerentes.
- A tabela de Unidades não precisa de rolagem horizontal em desktop comum para acessar os dados essenciais; em tela estreita, busca, filtros e ação principal continuam disponíveis.
- Cada ação mostra apenas os controles adequados ao papel; as Server Actions preservam escopo, auditoria e validação atuais.
- A revisão em `/dev/component-preview` cobre ambos os temas, larguras, estados e linhas representativas sem dados de produção.
- Carregamento, vazio, erro, filtro sem resultado, salvamento pendente e sucesso têm conteúdo compreensível e ação de recuperação quando pertinente.

## Riscos e questões para resolver durante implementação

- Confirmar se o papel Supervisor tem acesso à área Unidades; não inferir pelo desenho atual da tela.
- Confirmar qual estado de `papel do hub`, recebimento e distribuição deve continuar visível na tabela versus detalhe, sem remover uma decisão operacional necessária.
- Verificar se o filtro legado de `/filiais` possui parâmetros compartilhados por links/bookmarks antes de definir os redirects definitivos.
- Os `Ds*` de `/dev/component-preview` representam uma fundação independente. Misturá-los ao padrão `/equipe` criaria duas linguagens visuais; a bancada deve primeiro reaproveitar os primitives de produção conforme a DEC-012.
- O Controle de Redesign está na fase M1.10 com QA transversal pendente e limita as mudanças visuais permitidas. A implementação deverá ser registrada como etapa de padronização de UX com estados, papéis e revisão aprovados, sem tratar este plano de produto como autorização automática para abrir uma nova fase visual.

## Fora do escopo deste plano

- Alterar RBAC, vínculo de membro/unidade, distribuição de leads, configuração de operação, métricas ou persistência.
- Fundir o perfil detalhado de unidade com o perfil de membro ou converter as duas entidades em um novo modelo de dados.
- Migrar para um kit de design paralelo, introduzir dependências ou redesenhar outras tabelas do produto nesta entrega.

## Estado

Implementação de rota e tabela concluída. A QA autenticada visual e responsiva continua pendente conforme o gate M1.10 do controle de redesign.

## Implementação executada — 2026-09-25

- Adicionada navegação Equipe/Unidades na rota `/equipe`, com seleção refletida em `?visao=unidades` e manutenção de `/filiais` como redirecionamento legado.
- Reutilizado o `DataTable` de produção para unidades, com busca e paginação; a edição abre uma folha lateral e as ações operacionais ficam agrupadas por unidade.
- Consolidada a entrada lateral e atualizados o atalho da distribuição, o guia e o retorno do perfil de unidade. O escopo da consulta continua no servidor; Gestores consultam somente a própria unidade e Diretores acessam e gerenciam a lista do tenant.
- Adicionada tabela demonstrativa de componentes reais em `/dev/component-preview`.
- `npm run type-check`, ESLint direcionado e `git diff --check` concluídos. `agent:verify --level fast` foi tentado, mas o runtime falhou antes das verificações com `uv_os_get_passwd returned ENOMEM`. A validação visual autenticada em viewports reais continua pendente; UX-M1 permanece aberto.
