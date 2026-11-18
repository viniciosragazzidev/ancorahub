# Capitão Âncora — contrato oficial do mascote

Status: identidade visual aprovada e aplicada às artes e interfaces disponíveis em 18/11/2026; vídeos de boas-vindas pendentes de fonte editável.
Decisão: DEC-189.
Fonte oficial: design/mascote/capitao-ancora/referencia-oficial-capitao-ancora.png.

## Conceito e personalidade

Capitão Âncora é um marinheiro experiente, sábio e sempre próximo. Representa confiança e cuidado da Âncora Saúde. Sua personalidade é confiável e acolhedora, inteligente e estratégica, inspiradora e positiva.

### Modelo visual obrigatório

- Homem adulto, rosto arredondado cor de pêssego, nariz redondo alaranjado, olhos grandes e castanhos, bochechas rosadas e bigode branco curvado.
- Boné branco de marinheiro com aba azul-marinho e pequena âncora dourada no centro.
- Camisa branca de marinheiro, gola e lenço azul-marinho, calça azul-marinho, sapatos pretos simples.
- Listras douradas nos ombros e emblema dourado de âncora no peito.
- Silhueta compacta, formas arredondadas e proporção de referência aproximada de 5:7 para o corpo inteiro.
- Ilustração limpa, expressiva e amigável, com contorno nítido e acabamento 2D arredondado. A identidade do rosto, do bigode, do boné e do uniforme não muda entre poses.
- As artes não levam texto, números, dados de clientes ou elementos de interface.

### Paleta oficial

| Cor | Código | Uso |
|---|---|---|
| Azul-marinho | #002B73 | Cor principal, boné, calça, lenço e áreas de contraste |
| Azul de apoio | #0B5ED7 | Acentos e detalhes azuis |
| Verde | #00B26B | Marca e sinais positivos |
| Verde-lima | #7ED957 | Destaques positivos |
| Dourado | #FFC400 | Âncora, listras e pontos de atenção |
| Pele | #FF8A65 | Tom-base do rosto e das mãos |
| Branco quente | #FFF6E9 | Camisa, boné e áreas claras |
| Detalhe | #1F2937 | Contornos e detalhes escuros |

## Personagens e funções

- Capitão Âncora é o mascote principal da marca e pode aparecer na abertura, em banners, comemorações, orientação e ilustrações contextuais.
- Assistentes de convés são personagens de apoio. Usam uniforme mais simples que o do Capitão: camisa branca, detalhes azul-marinho e uma pequena âncora; sem as listras douradas de capitão.
- Sasá é a assistente de convés que mantém a conversa de avisos e perguntas do corretor. A troca do nome e da arte não muda sua função, permissões, ações ou rota.
- O avatar/logo de Sasá é uma exceção de recorte: usa somente o rosto oficial do Capitão, com bigode branco, boné com âncora dourada e fundo azul-marinho #002B73, conforme pedido de Vinicios em 18/11. Ilustrações de corpo inteiro da assistente continuam com uniforme simples.
- As dez ilustrações objetuais das áreas de Leads, Carteira, Plantão, Agenda, Cotação, Desempenho, Dicas, Jornada, Equipe e Mensagens continuam como ícones funcionais. Elas não são personagens e permanecem inalteradas.

## Regras de uso

- Reutilize o mesmo Capitão Âncora em todas as poses. Não crie uma segunda versão do Capitão com outro rosto, idade, bigode, boné ou uniforme.
- Use assistentes de convés somente como apoio, com uniforme simples e a mesma linguagem visual.
- Use poucos elementos auxiliares e apenas quando explicarem o contexto, como luneta, livro de lançamentos, cartões de leads, leme ou troféu.
- Não use estética ou vocabulário de pirata: espada, sabre, caveira, tapa-olho, gancho, bandeira pirata, roupa de pirata, saque, tesouro, baú, marujo ou tripulação.
- Use palavras diretas de trabalho: leads, equipe, atendimento, comissão, agenda, plantão, meta, resultado e próximo passo.
- Preserve o contraste e a legibilidade em recortes pequenos, telas móveis, avatares e temas claro e escuro.

## Biblioteca oficial de artes

As fontes PNG e a prancha de referência ficam em design/mascote/capitao-ancora/. Os arquivos WebP publicados e versionados ficam em public/mascote/2026-11-18/ para evitar que navegadores continuem exibindo imagens antigas em cache.

| Fonte | Arquivo publicado | Uso |
|---|---|---|
| capitao-repouso.png | 2026-11-18/repouso.webp | Repouso, espera e erro |
| capitao-boas-vindas.png | 2026-11-18/boas-vindas.webp, 2026-11-18/splash-capitao.webp | Boas-vindas |
| capitao-conquista.png | 2026-11-18/positivo.webp, 2026-11-18/desempenho-subindo.webp, 2026-11-18/venda-capitao.webp | Aceite, feedback positivo e celebração |
| capitao-luneta.png | 2026-11-18/desempenho-mirando.webp | Desempenho e próximos passos |
| capitao-financeiro.png | 2026-11-18/financeiro-controle.webp | Livro de comissões e lançamentos |
| capitao-distribuicao.png | 2026-11-18/distribuicao-capitao-leads.webp | Organização e distribuição de leads |
| sasa-logo-azul.png | 2026-11-18/sasa-logo-azul.webp | Avatar/logo de rosto da Sasá |

O arquivo splash-ancora.webp é a marca da empresa, não um personagem. As imagens antigas foram removidas do caminho ativo e preservadas em design/mascote/_archive/identidade-anterior/ somente como histórico; nunca devem voltar à interface.

## Componente e estados

O componente compartilhado é src/components/mascot/mascot.tsx. O contrato de estados está em src/components/mascot/mascot-config.ts. A ordem da lista de estados permanece estável porque corresponde ao número recebido pela máquina de estados da Rive.

No chat, o avatar da assistente é renderizado por `AssistantAvatar` em
`src/components/chat/assistant-avatar.tsx`; Sasá usa a forma `sasa` declarada em
`src/components/chat/types.ts` e o recorte `2026-11-18/sasa-logo-azul.webp`. Estados de
espera, trabalho e reação continuam usando o movimento existente e respeitam
`useReducedMotion`. As ilustrações do Capitão Âncora são selecionadas pelas
superfícies existentes de splash, banners, desempenho, financeiro, distribuição,
jornada e importação. A atualização não cria componente, token, movimento ou regra
de negócio.

| Estado | Situação | Arte |
|---|---|---|
| idle | Repouso ou tela vazia | repouso |
| welcome | Primeira entrada | boas-vindas |
| loading | Espera pelo servidor ou pela IA | repouso |
| lead_accepted | Aceite confirmado | positivo |
| lead_converted | Venda confirmada | positivo |
| success | Outra confirmação | positivo |
| error | Ação falhou | repouso |

A arte fica imóvel quando o movimento estiver desativado, quando “Menos animação” estiver ativo ou quando o sistema pedir movimento reduzido. O movimento existente continua no componente; não há mais vídeo pré-gravado com a identidade anterior. A Rive permanece opcional e só é carregada quando houver um arquivo local aprovado em public/mascote/mascote.riv.

Comemore somente depois da confirmação do servidor. Não mostre informação de cliente junto ao mascote. Nenhum estado repete em loop, exceto loading.

## Splash

A abertura usa `2026-11-18/splash-capitao.webp` e `splash-ancora.webp` sobre o azul oficial #002B73. Os banners de Início e Plantões compartilham a arte versionada do mesmo Capitão, evitando a exibição da imagem pirata anterior pelo cache do navegador. A animação de entrada, os tempos, a saída quando o app está pronto e o comportamento de sessão permanecem. A imagem chega pelo HTML do servidor, não captura cliques e é decorativa para leitores de tela.

## Uso nas áreas e controle

As vagas do mascote continuam centralizadas em src/components/mascot/mascot-placements.ts. Não ligar vagas nem alterar layout nesta atualização de identidade. Cada área continua decidindo seu estado e conteúdo; o mascote é decorativo e não representa uma regra de negócio.

Os arquivos renderizados `boas-vindas-v3-celular.mp4` e
`boas-vindas-v3-computador.mp4` ainda mostram a identidade anterior. O projeto
editável da composição não estava disponível nos worktrees revisados; atualizar e
re-renderizar os vídeos quando a fonte for recuperada.

Os objetos por rota continuam sob a flag já existente feature_ui_contextual_illustrations. A troca do personagem principal e do avatar de Sasá não altera essa flag nem expande onde os objetos aparecem.

## Manutenção

- Para uma pose nova, use o modelo oficial e a paleta acima, salve a fonte em design/mascote/capitao-ancora/ e o WebP otimizado em public/mascote/.
- Atualize este catálogo e o registro de implementação correspondente.
- Preserve os nomes de estado, ações, permissões e rotas existentes.
- Não adicione dependências para substituir arte ou movimento.
