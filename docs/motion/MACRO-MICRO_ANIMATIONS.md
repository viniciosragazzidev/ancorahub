# MACRO-MICRO_ANIMATIONS.md

## 1. Objetivo

Este documento define o padrão oficial de **macrointerações, microinterações, transições, feedbacks visuais e animações de estado** do dashboard.

O objetivo não é adicionar movimento por estética. Toda animação deve cumprir ao menos uma função:

- comunicar mudança de estado;
- orientar a atenção;
- confirmar uma ação;
- reduzir sensação de espera;
- explicar continuidade entre telas ou componentes;
- evitar mudanças visuais bruscas;
- ajudar o usuário a entender causa e efeito;
- transmitir qualidade, estabilidade e cuidado na experiência.

Nenhum componente interativo deve mudar de estado de forma abrupta quando uma transição puder explicar melhor o que aconteceu.

Ao mesmo tempo, nenhum componente deve ser animado apenas porque “fica bonito”. Movimento excessivo gera ruído, aumenta a carga cognitiva, prejudica acessibilidade e reduz a percepção de performance.

---

# 2. Princípios obrigatórios

## 2.1. Toda animação deve ter propósito

Antes de implementar qualquer animação, deve ser possível responder:

1. O que mudou?
2. Por que o usuário precisa perceber essa mudança?
3. Qual propriedade visual comunica melhor essa mudança?
4. Quanto tempo o usuário precisa para compreender o efeito?
5. A animação ainda faz sentido com `prefers-reduced-motion`?
6. A animação bloqueia ou atrasa alguma ação?
7. O usuário pode continuar interagindo durante o movimento?

Se nenhuma resposta justificar o movimento, a animação não deve existir.

---

## 2.2. Estado nunca deve mudar sem feedback

Toda ação iniciada pelo usuário deve produzir uma resposta visual em até **100 ms**.

Exemplos:

- botão pressionado;
- item selecionado;
- campo validado;
- filtro aplicado;
- aba alterada;
- requisição iniciada;
- conteúdo atualizado;
- item removido;
- ação concluída;
- erro retornado;
- acesso negado.

O sistema não deve deixar o usuário em dúvida sobre:

- se o clique foi registrado;
- se a solicitação começou;
- se ainda está em andamento;
- se foi concluída;
- se falhou;
- se pode ser desfeita.

---

## 2.3. Continuidade visual

Quando um elemento muda de estado, a interface deve preservar a sensação de continuidade.

Evitar:

- elementos aparecendo instantaneamente;
- conteúdo pulando;
- alturas mudando sem transição;
- skeleton desaparecendo e conteúdo surgindo de forma seca;
- cards trocando completamente sem relação visual;
- modais abrindo sem contexto;
- notificações entrando de forma agressiva;
- listas reordenando sem indicar movimento.

Preferir:

- fade;
- crossfade;
- expansão controlada;
- deslocamento curto;
- transformação de forma;
- morph entre estados;
- highlight temporário;
- progressão visual;
- stagger discreto;
- layout animation.

---

## 2.4. Velocidade percebida acima de duração estética

A animação não deve tornar a interface mais lenta.

Regras:

- ações simples devem parecer imediatas;
- transições não devem atrasar execução;
- carregamentos não devem esperar uma animação terminar;
- feedback de clique deve iniciar imediatamente;
- a animação deve acompanhar o processo, não segurá-lo;
- componentes críticos não devem depender de delay artificial;
- delays só devem ser usados para leitura, hierarquia ou redução de ruído.

---

## 2.5. Movimento consistente

O dashboard deve usar um vocabulário de movimento previsível.

Exemplo:

- elementos que entram: `fade + translate`;
- elementos que saem: `fade + translate inverso`;
- expansão: `height/scaleY + fade`;
- confirmação: `scale leve + check`;
- erro: `shake curto + highlight`;
- carregamento: `progress + pulse controlado`;
- reordenação: layout animation;
- hover: elevação e deslocamento mínimo;
- seleção: background, border e indicator animados.

Não criar uma animação diferente para cada card.

---

# 3. Classificação das animações

## 3.1. Microinterações

Animações pequenas e locais, geralmente ligadas a uma ação pontual.

Exemplos:

- hover de botão;
- foco de campo;
- toggle;
- checkbox;
- expansão de dropdown;
- validação;
- tooltip;
- badge;
- reação de ícone;
- indicador de seleção;
- loading de botão.

Duração recomendada:

- entre `80 ms` e `240 ms`.

---

## 3.2. Macrointerações

Animações que explicam mudanças maiores de contexto ou estrutura.

Exemplos:

- troca de rota;
- abertura de modal;
- painel lateral;
- mudança de dashboard;
- expansão de seção;
- reordenação de lista;
- troca de visualização;
- carregamento de página;
- navegação entre etapas;
- transição entre estados complexos.

Duração recomendada:

- entre `180 ms` e `500 ms`.

---

## 3.3. Animações contínuas

Movimentos que permanecem ativos enquanto um estado existe.

Exemplos:

- spinner;
- barra de progresso;
- skeleton shimmer;
- pulso de conexão;
- indicador de sincronização;
- upload em andamento;
- atividade em tempo real.

Devem ser usadas com cautela.

Nenhuma animação contínua deve:

- competir com o conteúdo;
- piscar;
- causar desconforto;
- permanecer ativa após o processo terminar;
- usar movimento exagerado;
- provocar alto consumo de CPU ou GPU.

---

# 4. Tokens de movimento

Todos os componentes devem reutilizar os mesmos tokens.

```ts
export const motion = {
  duration: {
    instant: 80,
    fast: 120,
    base: 180,
    medium: 240,
    slow: 320,
    slower: 420,
    emphasis: 560,
  },

  delay: {
    none: 0,
    subtle: 40,
    base: 80,
    contextual: 120,
    stagger: 40,
  },

  distance: {
    xsmall: 2,
    small: 4,
    base: 8,
    medium: 12,
    large: 16,
    panel: 24,
  },

  scale: {
    pressed: 0.98,
    subtle: 0.99,
    enter: 0.96,
    emphasized: 1.02,
  },

  easing: {
    standard: [0.2, 0, 0, 1],
    enter: [0, 0, 0.2, 1],
    exit: [0.4, 0, 1, 1],
    emphasized: [0.2, 0.8, 0.2, 1],
    spring: {
      type: "spring",
      stiffness: 420,
      damping: 32,
      mass: 0.8,
    },
  },
}
```

---

# 5. Regras de duração

## 5.1. Ações instantâneas

Usar entre `80 ms` e `140 ms`.

Aplicações:

- hover;
- active;
- focus;
- pressed;
- mudança de cor;
- mudança de border;
- mudança de opacidade;
- alteração de ícone;
- tooltip simples.

---

## 5.2. Mudanças de componente

Usar entre `160 ms` e `260 ms`.

Aplicações:

- dropdown;
- accordion;
- tabs;
- card expandido;
- painel interno;
- troca de conteúdo;
- atualização de status;
- skeleton para conteúdo.

---

## 5.3. Mudanças estruturais

Usar entre `240 ms` e `420 ms`.

Aplicações:

- modal;
- drawer;
- sidebar;
- mudança de rota;
- layout responsivo;
- reordenação de lista;
- transição entre etapas.

---

## 5.4. Ações de destaque

Usar entre `320 ms` e `560 ms`.

Aplicações:

- conclusão importante;
- sucesso de operação longa;
- onboarding;
- primeira visualização;
- transição de fluxo;
- confirmação de pagamento;
- finalização de cadastro.

Essas animações não devem ser usadas em ações repetitivas.

---

# 6. Easing

## 6.1. Entrada

Elementos entrando devem desacelerar ao chegar.

```css
cubic-bezier(0, 0, 0.2, 1)
```

---

## 6.2. Saída

Elementos saindo devem acelerar ao desaparecer.

```css
cubic-bezier(0.4, 0, 1, 1)
```

---

## 6.3. Mudança de estado

Para propriedades que permanecem visíveis durante a alteração:

```css
cubic-bezier(0.2, 0, 0, 1)
```

---

## 6.4. Spring

Usar spring somente em:

- drag and drop;
- retorno de posição;
- expansão física;
- toggles;
- elementos que simulam resposta tátil.

Não usar spring em:

- textos;
- toasts críticos;
- mensagens de erro;
- tabelas densas;
- modais corporativos;
- carregamentos.

---

# 7. Padrão de entrada e saída

## 7.1. Entrada padrão

```ts
const enter = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
  },
  transition: {
    duration: 0.18,
    ease: [0, 0, 0.2, 1],
  },
}
```

---

## 7.2. Saída padrão

```ts
const exit = {
  opacity: 0,
  y: -4,
  transition: {
    duration: 0.12,
    ease: [0.4, 0, 1, 1],
  },
}
```

---

## 7.3. Crossfade

Usar quando um conteúdo substitui outro no mesmo espaço.

Exemplos:

- status;
- label;
- valor;
- ícone;
- skeleton;
- conteúdo de tab;
- etapa de formulário;
- resultado de filtro.

Regras:

- o conteúdo antigo inicia a saída;
- o novo conteúdo inicia a entrada antes ou imediatamente após a saída;
- o container deve preservar largura e altura sempre que possível;
- não deve haver salto de layout.

---

# 8. Estados obrigatórios por componente

Todo componente interativo deve prever:

- `idle`;
- `hover`;
- `focus-visible`;
- `active`;
- `loading`;
- `success`;
- `error`;
- `disabled`;
- `selected`, quando aplicável;
- `expanded`, quando aplicável;
- `dragging`, quando aplicável;
- `empty`, quando aplicável.

Não é aceitável implementar somente o estado padrão.

---

# 9. Botões

## 9.1. Hover

Comportamento:

- transição de background;
- transição de border;
- elevação leve, quando aplicável;
- ícone pode deslocar entre `2 px` e `4 px`;
- duração entre `120 ms` e `180 ms`.

```css
.button {
  transition:
    background-color 160ms cubic-bezier(0.2, 0, 0, 1),
    border-color 160ms cubic-bezier(0.2, 0, 0, 1),
    color 160ms cubic-bezier(0.2, 0, 0, 1),
    transform 120ms cubic-bezier(0.2, 0, 0, 1),
    box-shadow 160ms cubic-bezier(0.2, 0, 0, 1);
}

.button:hover {
  transform: translateY(-1px);
}
```

---

## 9.2. Pressed

```css
.button:active {
  transform: translateY(0) scale(0.98);
}
```

O feedback deve ser curto e imediato.

---

## 9.3. Loading

Ao iniciar uma ação:

- manter a largura do botão;
- evitar troca brusca de label;
- fazer crossfade entre label e loading;
- bloquear cliques repetidos;
- manter contexto da ação;
- indicar progresso quando for possível estimá-lo;
- não usar spinner sozinho quando houver espaço para texto.

Exemplo:

- `Salvar` → `Salvando...` → `Salvo`;
- `Enviar` → `Enviando 42%` → `Enviado`;
- `Gerar relatório` → `Preparando dados` → `Gerando arquivo` → `Concluído`.

---

## 9.4. Success

Após conclusão:

- o spinner reduz e desaparece;
- o ícone de check entra com fade e scale;
- o texto muda por crossfade;
- manter o estado por `600 ms` a `1200 ms`;
- retornar ao estado normal quando necessário.

Não usar uma animação longa para ações frequentes.

---

## 9.5. Error

Ao falhar:

- trocar o estado visual;
- exibir mensagem objetiva;
- realizar shake curto apenas se o erro estiver diretamente ligado ao botão;
- permitir nova tentativa;
- não remover contexto da ação.

Shake recomendado:

```ts
[0, -4, 4, -2, 2, 0]
```

Duração máxima:

```txt
240 ms
```

---

# 10. Inputs, selects e campos de formulário

## 10.1. Focus

Ao receber foco:

- border deve transicionar;
- ring deve aparecer suavemente;
- label pode mudar de cor;
- ícone contextual pode ganhar contraste;
- duração entre `120 ms` e `180 ms`.

O foco não pode depender apenas de cor.

---

## 10.2. Validação

A validação deve ocorrer:

- após blur;
- após tentativa de envio;
- ou em tempo real apenas quando isso ajudar.

Ao mudar de válido para inválido:

- mensagem entra com fade + translateY;
- container ajusta altura suavemente;
- border muda por transição;
- ícone de erro entra com scale leve;
- evitar shake a cada tecla.

Ao corrigir:

- mensagem de erro sai por fade;
- mensagem de sucesso pode entrar;
- a altura deve retornar sem salto.

---

## 10.3. Campo com busca assíncrona

Estados:

1. idle;
2. digitando;
3. debounce;
4. buscando;
5. resultados;
6. vazio;
7. erro.

Comportamento:

- mostrar loading somente após `150 ms` a `250 ms`;
- evitar spinner piscando em respostas rápidas;
- resultados entram com stagger discreto;
- lista anterior pode permanecer com opacidade reduzida;
- não apagar resultados instantaneamente durante refetch;
- exibir atualização em andamento de forma não bloqueante.

---

# 11. Checkbox, radio e toggle

## 11.1. Checkbox

Ao marcar:

- border e background transicionam;
- check aparece por scale e opacity;
- duração entre `120 ms` e `180 ms`.

Ao desmarcar:

- check desaparece antes do background;
- evitar inversão brusca.

---

## 11.2. Radio

Ao selecionar:

- indicador interno expande de `scale(0.6)` para `scale(1)`;
- opacidade de `0` para `1`;
- duração entre `120 ms` e `160 ms`.

---

## 11.3. Toggle

Ao alternar:

- thumb se desloca com spring controlado;
- track muda de cor;
- ícone interno pode fazer crossfade;
- estado disabled deve remover spring.

A alteração visual deve começar imediatamente, mesmo quando a persistência for assíncrona.

Se a persistência falhar:

- reverter o toggle;
- animar o retorno;
- mostrar toast de erro;
- explicar que a alteração não foi salva.

---

# 12. Cards

Todo card interativo deve possuir pelo menos uma microinteração.

## 12.1. Card clicável

Hover:

- elevação leve;
- border ganha contraste;
- background pode variar discretamente;
- ícone ou seta pode deslocar entre `2 px` e `4 px`;
- duração entre `160 ms` e `220 ms`.

Pressed:

- scale máximo de `0.995` a `0.98`, conforme tamanho;
- não deformar cards grandes excessivamente.

---

## 12.2. Card selecionável

Ao selecionar:

- border transiciona;
- indicator entra;
- background muda suavemente;
- conteúdo secundário pode ganhar contraste;
- check ou badge aparece por fade + scale.

Ao desmarcar:

- reverse da mesma animação.

---

## 12.3. Card expansível

Ao expandir:

- cabeçalho permanece estável;
- conteúdo interno entra com height + opacity;
- seta rotaciona;
- border radius pode se adaptar;
- evitar animar `height: auto` com implementação instável;
- preferir layout animation ou grid rows.

```css
.content {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows 240ms cubic-bezier(0.2, 0, 0, 1),
    opacity 180ms cubic-bezier(0.2, 0, 0, 1);
}

.content[data-open="true"] {
  grid-template-rows: 1fr;
  opacity: 1;
}
```

---

## 12.4. Card com dados atualizados

Quando um valor mudar:

- fazer crossfade;
- aplicar highlight temporário;
- não piscar o card inteiro;
- preservar alinhamento numérico;
- indicar tendência quando relevante.

Highlight recomendado:

- entrada em `120 ms`;
- permanência de `600 ms`;
- saída em `400 ms`.

---

## 12.5. Card carregando

Preferir:

- skeleton estrutural;
- shimmer discreto;
- conteúdo entrando por crossfade;
- dimensões finais preservadas.

Não usar:

- spinner central em todos os cards;
- skeleton genérico sem relação com o layout;
- animação intensa em uma grade inteira.

---

# 13. Tabelas e listas

## 13.1. Entrada inicial

- cabeçalho deve aparecer sem stagger excessivo;
- linhas podem entrar em blocos;
- stagger entre `20 ms` e `40 ms`;
- limitar stagger a no máximo 8 itens;
- listas longas devem renderizar imediatamente.

---

## 13.2. Inserção de item

Quando um item for adicionado:

- abrir espaço por layout animation;
- item entra com fade + translateY;
- aplicar highlight temporário;
- manter foco ou scroll contextual.

---

## 13.3. Remoção

Fluxo recomendado:

1. item recebe estado de remoção;
2. opacidade reduz;
3. conteúdo desloca levemente;
4. altura colapsa;
5. lista reorganiza;
6. toast de desfazer aparece.

Não remover o item instantaneamente.

---

## 13.4. Reordenação

Ao reordenar:

- elementos devem animar sua nova posição;
- o item movido deve ganhar elevação;
- placeholder deve preservar espaço;
- ao soltar, usar spring controlado;
- não fazer fade da lista inteira.

---

## 13.5. Atualização de linha

Quando uma linha muda:

- animar apenas as células alteradas;
- usar highlight temporário;
- não rerenderizar visualmente toda a tabela;
- preservar posição, seleção e scroll.

---

## 13.6. Empty state

Ao entrar em estado vazio:

- remover lista por fade;
- empty state entra com fade + translate;
- ação principal ganha leve ênfase;
- não usar ilustração animada em loops longos.

---

# 14. Tabs

Ao trocar de tab:

- indicator deve deslizar;
- conteúdo deve fazer crossfade;
- direção do movimento pode refletir a posição da tab;
- altura deve ser preservada quando possível;
- não atrasar a troca por causa da animação.

Duração recomendada:

- indicator: `180 ms`;
- conteúdo: `160 ms` a `220 ms`.

---

# 15. Accordion e collapse

Ao abrir:

- seta rotaciona;
- conteúdo expande;
- opacidade aumenta;
- margem interna aparece;
- duração entre `200 ms` e `280 ms`.

Ao fechar:

- opacidade reduz primeiro;
- altura colapsa em seguida;
- não remover o conteúdo antes do exit terminar.

---

# 16. Dropdown, popover e context menu

## 16.1. Entrada

- fade;
- scale de `0.96` para `1`;
- translate entre `4 px` e `8 px`;
- transform-origin deve respeitar o trigger;
- duração entre `120 ms` e `180 ms`.

---

## 16.2. Saída

- duração menor que a entrada;
- fade;
- scale discreto;
- não mover excessivamente.

---

## 16.3. Itens internos

- hover imediato;
- seleção com background e icon indicator;
- submenu com entrada direcional;
- keyboard navigation sem animações que atrasem foco.

---

# 17. Tooltip

Regras:

- delay de entrada entre `300 ms` e `500 ms`;
- sem delay quando o usuário navega entre tooltips próximos;
- entrada com fade + translate de `2 px` a `4 px`;
- saída entre `80 ms` e `120 ms`;
- nunca depender do tooltip para informação essencial.

---

# 18. Modal

## 18.1. Entrada

Backdrop:

- opacity de `0` para valor final;
- duração entre `180 ms` e `240 ms`.

Conteúdo:

- fade;
- translateY de `12 px` a `20 px`;
- scale entre `0.98` e `1`;
- duração entre `220 ms` e `320 ms`.

---

## 18.2. Saída

- conteúdo sai mais rápido;
- backdrop desaparece por último;
- duração entre `160 ms` e `220 ms`.

---

## 18.3. Regras

- foco deve ser movido após montagem;
- animação não deve impedir fechamento;
- `Escape` deve funcionar imediatamente;
- o modal não deve abrir com bounce;
- modais críticos não devem usar movimento lúdico;
- alterações internas devem usar crossfade ou step transition.

---

# 19. Drawer e side panel

Comportamento:

- painel entra da direção de origem;
- backdrop faz fade;
- conteúdo interno pode usar stagger limitado;
- largura não deve oscilar;
- resize responsivo deve ser suave, mas não lento.

Duração:

- `240 ms` a `360 ms`.

---

# 20. Sidebar

## 20.1. Expandida para recolhida

Animar:

- largura;
- labels;
- tooltips;
- alinhamento dos ícones;
- indicador ativo;
- conteúdo principal.

Evitar:

- labels sumirem antes da largura reduzir;
- conteúdo principal pular;
- ícones mudarem de posição de forma desconectada.

Sequência recomendada:

1. reduzir opacidade dos labels;
2. iniciar transição de largura;
3. reposicionar ícones;
4. ajustar conteúdo principal;
5. ativar tooltips da versão recolhida.

---

## 20.2. Item ativo

O item ativo deve usar:

- indicator lateral ou background;
- layout animation entre itens;
- transição de cor;
- ícone com contraste;
- label estável.

---

# 21. Navegação e troca de rota

A transição de página deve ser discreta.

Padrão:

- conteúdo atual reduz opacidade;
- nova página entra com fade + translateY curto;
- header persistente não deve reanimar;
- sidebar persistente não deve reanimar;
- skeleton deve respeitar a estrutura da página;
- transição deve iniciar após mudança de rota, não antes.

Duração:

- saída: `100 ms` a `140 ms`;
- entrada: `180 ms` a `260 ms`.

Evitar transições cinematográficas entre páginas de dashboard.

---

# 22. Carregamento

## 22.1. Loading imediato

Para ações com resposta menor que `300 ms`:

- usar feedback local;
- evitar spinner;
- manter conteúdo anterior;
- indicar processamento de forma mínima.

---

## 22.2. Loading intermediário

Entre `300 ms` e `1500 ms`:

- spinner local;
- skeleton;
- progress indicator;
- label de ação;
- conteúdo anterior pode permanecer.

---

## 22.3. Loading longo

Acima de `1500 ms`:

- informar etapa;
- mostrar progresso;
- atualizar texto;
- permitir cancelamento quando possível;
- manter interface responsiva;
- explicar o que está acontecendo.

---

## 22.4. Skeleton

O skeleton deve:

- refletir a estrutura real;
- preservar espaço;
- ter shimmer discreto;
- parar ao carregar;
- fazer crossfade com o conteúdo;
- respeitar reduced motion.

Não usar shimmer em dezenas de elementos simultâneos.

---

## 22.5. Spinner

Usar quando:

- não existe progresso mensurável;
- a ação é curta;
- o contexto é local.

Não usar spinner sem label em ações longas.

---

# 23. Sistema de toast dinâmico

O toast deve funcionar como um componente de acompanhamento de processos, não apenas como mensagem temporária.

## 23.1. Tipos de toast

- `info`;
- `loading`;
- `progress`;
- `success`;
- `warning`;
- `error`;
- `undo`;
- `persistent`;
- `action-required`.

---

## 23.2. Entrada

O toast deve entrar com:

- fade;
- translateX ou translateY curto;
- scale discreto;
- altura animada;
- duração entre `180 ms` e `260 ms`.

Evitar slide agressivo atravessando a tela.

---

## 23.3. Toast de processo

Fluxo:

1. o usuário inicia a ação;
2. toast aparece em estado `loading`;
3. label informa a etapa atual;
4. progress bar avança;
5. conteúdo se adapta sem recriar o toast;
6. conclusão transforma o mesmo toast em `success`;
7. erro transforma o mesmo toast em `error`;
8. o toast permanece tempo suficiente para leitura;
9. sai por fade e collapse.

Exemplo:

```txt
Preparando relatório...
↓
Consultando registros — 24%
↓
Processando dados — 61%
↓
Gerando arquivo — 88%
↓
Relatório concluído
```

---

## 23.4. Progress bar

A barra deve:

- animar continuamente entre valores;
- nunca regredir sem explicação;
- evitar saltos bruscos;
- usar progresso indeterminado quando não houver valor real;
- desacelerar perto de 100%;
- concluir apenas quando a operação realmente terminar.

Nunca simular porcentagens falsas quando o sistema não possui progresso mensurável.

---

## 23.5. Mudança de estado

O toast não deve ser removido e recriado.

Deve ocorrer transformação interna:

- spinner → check;
- progress bar → linha concluída;
- label antiga → label nova por crossfade;
- cor de status transiciona;
- ações são atualizadas;
- altura se adapta suavemente.

---

## 23.6. Toast de erro

Deve conter:

- ação que falhou;
- causa compreensível;
- próxima ação;
- botão de tentar novamente, quando aplicável;
- link para detalhes, quando necessário.

Animação:

- destaque de erro;
- ícone entra com fade + scale;
- shake leve apenas uma vez;
- toast permanece visível até leitura em erros críticos.

---

## 23.7. Toast de undo

Ao remover ou alterar algo reversível:

- mostrar ação realizada;
- exibir botão `Desfazer`;
- progress indicator representa tempo restante;
- ao desfazer, toast transforma em confirmação;
- ao expirar, conclui a ação.

---

## 23.8. Agrupamento

Quando vários toasts forem disparados:

- não empilhar indefinidamente;
- agrupar ações repetidas;
- atualizar contagem;
- manter no máximo de 3 a 5 visíveis;
- permitir expansão para histórico.

---

# 24. Upload e download

## 24.1. Upload

Estados:

- aguardando;
- preparando;
- enviando;
- processando;
- concluído;
- falhou;
- cancelado.

Feedback:

- barra de progresso;
- velocidade, quando útil;
- tamanho enviado;
- thumbnail;
- cancelamento;
- retry;
- conclusão animada.

---

## 24.2. Download

Fluxo:

- botão entra em loading;
- toast acompanha preparação;
- progresso é mostrado se disponível;
- conclusão altera ícone;
- falha mantém opção de tentar novamente.

---

# 25. Drag and drop

Ao iniciar drag:

- item ganha elevação;
- scale entre `1.01` e `1.03`;
- cursor muda;
- placeholder preserva espaço;
- demais itens animam posição.

Ao soltar:

- item encaixa com spring;
- highlight temporário confirma nova posição;
- erro de persistência deve reverter visualmente o item.

---

# 26. Filtros e busca

## 26.1. Aplicação de filtros

Ao aplicar:

- chips entram ou saem com layout animation;
- contador atualiza por crossfade;
- tabela mantém estado anterior durante refetch;
- overlay ou progress discreto indica atualização;
- resultados entram sem reset visual agressivo.

---

## 26.2. Limpeza de filtros

- chips saem;
- contador retorna;
- lista faz crossfade;
- não apagar tudo antes dos dados novos chegarem.

---

## 26.3. Busca

- debounce entre `200 ms` e `400 ms`;
- indicador de busca após pequeno delay;
- resultados atualizam por crossfade;
- termo encontrado pode receber highlight;
- estado vazio entra suavemente.

---

# 27. Paginação

Ao mudar de página:

- manter o cabeçalho;
- preservar altura mínima;
- conteúdo atual pode reduzir opacidade;
- skeleton pode substituir linhas;
- nova página entra por crossfade;
- scroll deve ser controlado;
- foco deve permanecer coerente.

---

# 28. Dados em tempo real

Ao receber atualização:

- não piscar a interface inteira;
- animar somente o dado alterado;
- usar highlight temporário;
- mostrar timestamp atualizado;
- ordenar itens com layout animation;
- preservar interação atual do usuário.

Mudanças muito frequentes devem ser agrupadas.

---

# 29. Gráficos

## 29.1. Entrada

- eixos aparecem primeiro;
- dados entram depois;
- duração máxima de `500 ms`;
- não usar animação longa a cada refetch.

---

## 29.2. Atualização

- interpolar valores;
- preservar escala quando possível;
- tooltip deve acompanhar ponto;
- legenda deve atualizar por crossfade;
- evitar reiniciar toda a animação.

---

## 29.3. Seleção

- elemento selecionado ganha contraste;
- demais reduzem opacidade levemente;
- transição entre `120 ms` e `200 ms`.

---

# 30. Indicadores, badges e status

Ao mudar status:

- label faz crossfade;
- cor transiciona;
- ícone muda;
- container preserva tamanho;
- highlight pode indicar atualização recente.

Exemplo:

```txt
Pendente → Processando → Concluído
```

Não trocar tudo instantaneamente.

---

# 31. Contadores e métricas

Quando um número mudar:

- usar crossfade ou count-up curto;
- count-up somente em mudanças relevantes;
- preservar largura com numerais tabulares;
- não animar números em toda renderização;
- não usar count-up em tabelas grandes.

Duração:

- `300 ms` a `600 ms`.

---

# 32. Confirmações

## 32.1. Ação simples

- botão muda para loading;
- conclusão mostra check;
- toast confirma;
- estado visual atualiza.

---

## 32.2. Ação destrutiva

Fluxo:

1. confirmação;
2. botão destrutivo entra em loading;
3. elemento entra em estado de remoção;
4. toast de undo aparece;
5. remoção final é concluída.

A animação não deve suavizar a gravidade da ação.

---

# 33. Erros

Erros devem ser visíveis, localizados e acionáveis.

## 33.1. Erro local

- campo ou componente recebe destaque;
- mensagem entra;
- foco pode ser direcionado;
- ação de correção fica disponível.

---

## 33.2. Erro de seção

- seção faz fade para estado de erro;
- preservar dimensões;
- exibir retry;
- não desmontar toda a página.

---

## 33.3. Erro global

- toast persistente ou banner;
- entrada discreta;
- mensagem clara;
- ação de recuperação;
- sem animação excessiva.

---

# 34. Estados vazios

O empty state deve explicar:

- o que está vazio;
- por que está vazio;
- como adicionar conteúdo;
- o que acontece depois.

Entrada:

- fade;
- translateY curto;
- ação principal com ênfase discreta.

---

# 35. Onboarding e progressão

Ao avançar entre etapas:

- direção deve representar avanço ou retorno;
- título e conteúdo fazem transição coordenada;
- progress indicator anima;
- validações aparecem antes da troca;
- dados inseridos não devem desaparecer abruptamente.

---

# 36. Delays

Delay não deve ser usado como decoração.

Usos aceitáveis:

- tooltip;
- stagger;
- evitar spinner piscando;
- confirmação temporária;
- aguardar leitura;
- coordenar saída e entrada;
- reduzir ruído em estados transitórios.

Usos proibidos:

- atrasar clique;
- atrasar navegação;
- atrasar abertura de modal;
- atrasar resposta de botão;
- prolongar artificialmente loading;
- bloquear fluxo.

---

# 37. Stagger

Stagger deve ser discreto.

Regras:

- intervalo entre `20 ms` e `50 ms`;
- limitar a 8 elementos;
- listas longas não devem usar stagger;
- repetir stagger em toda atualização é proibido;
- usar somente na entrada inicial ou em grupos pequenos.

---

# 38. Reduced motion

Todo o sistema deve respeitar:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

Além disso:

- substituir movimento por fade;
- remover parallax;
- remover spring;
- remover shake;
- manter feedback de estado;
- não remover informação;
- manter progress indicators funcionais.

---

# 39. Performance

## 39.1. Propriedades preferidas

Priorizar:

- `transform`;
- `opacity`.

Usar com cautela:

- `height`;
- `width`;
- `top`;
- `left`;
- `box-shadow`;
- `filter`;
- `backdrop-filter`.

---

## 39.2. Regras

- evitar animar grandes áreas com blur;
- evitar múltiplos shadows animados;
- não usar `will-change` globalmente;
- remover `will-change` após animação;
- virtualizar listas longas;
- não animar centenas de elementos;
- evitar reflow em cascata;
- testar em dispositivos modestos;
- manter 60 fps sempre que possível.

---

# 40. Componentes assíncronos

Todo componente que dispara requisição deve possuir:

- estado otimista, quando seguro;
- estado loading;
- estado success;
- estado error;
- rollback;
- retry;
- feedback local;
- feedback global quando necessário;
- bloqueio de duplicidade;
- persistência visual durante refetch.

---

# 41. Estados otimistas

Usar estado otimista quando:

- a ação é reversível;
- a chance de sucesso é alta;
- a resposta visual imediata melhora a experiência;
- existe rollback claro.

Exemplos:

- toggle;
- favoritar;
- arquivar;
- marcar como lido;
- reorder;
- atualizar status simples.

Ao falhar:

- reverter visualmente;
- informar erro;
- explicar que a ação não foi salva.

---

# 42. Hierarquia de feedback

Prioridade:

1. feedback no elemento acionado;
2. feedback no contexto local;
3. feedback em toast;
4. feedback global.

Não usar toast para substituir um feedback que deveria existir no próprio componente.

Exemplo incorreto:

- clicar em `Salvar`;
- botão não muda;
- apenas um toast aparece.

Exemplo correto:

- botão entra em loading;
- formulário bloqueia submissão duplicada;
- toast acompanha processo;
- botão confirma sucesso;
- dados atualizam.

---

# 43. Padrões de implementação

## 43.1. CSS transitions

Usar para:

- hover;
- focus;
- border;
- color;
- opacity;
- transform simples;
- componentes com dois estados.

---

## 43.2. Framer Motion ou Motion

Usar para:

- mount e unmount;
- layout animation;
- reorder;
- shared layout;
- modais;
- drawers;
- crossfade;
- componentes assíncronos complexos.

---

## 43.3. Web Animations API

Usar quando:

- controle imperativo for necessário;
- animações precisarem ser canceladas;
- houver integração com eventos nativos;
- evitar dependência adicional fizer sentido.

---

# 44. Variants recomendadas

```ts
export const fade = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
}

export const fadeUp = {
  hidden: {
    opacity: 0,
    y: 8,
  },
  visible: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: -4,
  },
}

export const scaleIn = {
  hidden: {
    opacity: 0,
    scale: 0.96,
  },
  visible: {
    opacity: 1,
    scale: 1,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
  },
}

export const collapse = {
  hidden: {
    opacity: 0,
    height: 0,
  },
  visible: {
    opacity: 1,
    height: "auto",
  },
  exit: {
    opacity: 0,
    height: 0,
  },
}
```

---

# 45. Hook de preferência de movimento

```ts
import { useEffect, useState } from "react"

export function useReducedMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    )

    const updatePreference = () => {
      setReducedMotion(mediaQuery.matches)
    }

    updatePreference()

    mediaQuery.addEventListener("change", updatePreference)

    return () => {
      mediaQuery.removeEventListener("change", updatePreference)
    }
  }, [])

  return reducedMotion
}
```

---

# 46. Exemplo de botão assíncrono

```tsx
function AsyncButton({
  status,
  progress,
  children,
}: {
  status: "idle" | "loading" | "success" | "error"
  progress?: number
  children: React.ReactNode
}) {
  return (
    <button
      type="submit"
      disabled={status === "loading"}
      data-status={status}
      className="async-button"
    >
      <AnimatePresence mode="wait" initial={false}>
        {status === "idle" && (
          <motion.span
            key="idle"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            {children}
          </motion.span>
        )}

        {status === "loading" && (
          <motion.span
            key="loading"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            {progress !== undefined
              ? `Processando ${progress}%`
              : "Processando..."}
          </motion.span>
        )}

        {status === "success" && (
          <motion.span
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            Concluído
          </motion.span>
        )}

        {status === "error" && (
          <motion.span
            key="error"
            initial={{ opacity: 0, x: -4 }}
            animate={{
              opacity: 1,
              x: [0, -3, 3, 0],
            }}
            exit={{ opacity: 0 }}
          >
            Tentar novamente
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}
```

---

# 47. Exemplo de toast de progresso

```ts
type ProcessToastState =
  | {
      status: "loading"
      title: string
      description?: string
    }
  | {
      status: "progress"
      title: string
      description?: string
      progress: number
    }
  | {
      status: "success"
      title: string
      description?: string
    }
  | {
      status: "error"
      title: string
      description?: string
      retry?: () => void
    }
```

```tsx
function ProcessToast({ state }: { state: ProcessToastState }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{
        duration: 0.2,
        ease: [0.2, 0, 0, 1],
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={state.status}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
        >
          <ToastIcon status={state.status} />

          <div>
            <strong>{state.title}</strong>

            {state.description && (
              <p>{state.description}</p>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {state.status === "progress" && (
        <div className="progress-track">
          <motion.div
            className="progress-bar"
            initial={false}
            animate={{
              width: `${state.progress}%`,
            }}
            transition={{
              duration: 0.24,
              ease: [0.2, 0, 0, 1],
            }}
          />
        </div>
      )}
    </motion.div>
  )
}
```

---

# 48. Matriz de comportamento por componente

| Componente | Entrada | Hover | Mudança de estado | Loading | Saída |
|---|---|---|---|---|---|
| Button | Fade opcional | Elevação leve | Crossfade de label | Spinner/progress local | Fade |
| Card | Fade + translate | Border + shadow | Highlight/crossfade | Skeleton | Fade + collapse |
| Modal | Fade + scale | Não aplicável | Crossfade interno | Loading contextual | Fade + scale |
| Drawer | Slide + fade | Não aplicável | Layout animation | Skeleton/local | Slide + fade |
| Toast | Fade + translate | Elevação leve | Morph interno | Progress dinâmico | Fade + collapse |
| Input | Fade opcional | Border | Label + validation | Spinner interno | Fade |
| Dropdown | Fade + scale | Background | Indicator | Loading na lista | Fade + scale |
| Tab | Fade | Indicator | Slide/crossfade | Skeleton local | Fade |
| Table row | Fade + layout | Background | Highlight | Skeleton row | Fade + collapse |
| Badge | Fade + scale | Opcional | Crossfade | Não aplicável | Fade |
| Toggle | Fade opcional | Track | Spring | Optimistic | Fade |
| Chart | Draw/fade | Highlight | Interpolation | Skeleton | Fade |
| Tooltip | Fade + translate | Não aplicável | Crossfade | Não aplicável | Fade |
| Accordion | Height + fade | Background | Rotate + expand | Local | Height + fade |

---

# 49. Critérios de aceite

Uma implementação só deve ser considerada concluída quando:

- todos os estados foram implementados;
- o clique gera feedback imediato;
- loading não causa salto de layout;
- sucesso é comunicado;
- erro possui recuperação;
- animações de entrada e saída existem quando necessárias;
- reduced motion foi testado;
- teclado e foco continuam funcionais;
- não existem delays artificiais;
- não existem animações repetitivas sem propósito;
- o componente mantém 60 fps em uso normal;
- o comportamento é consistente com componentes similares;
- o toast acompanha processos longos;
- mudanças assíncronas não apagam contexto;
- o usuário nunca fica sem saber o estado da ação.

---

# 50. Checklist de pull request

## Componente

- [ ] Possui estados `idle`, `hover`, `focus`, `active`, `loading`, `success`, `error` e `disabled`.
- [ ] A transição usa tokens oficiais.
- [ ] Não existem valores arbitrários sem justificativa.
- [ ] A animação comunica uma mudança real.
- [ ] A animação não atrasa a ação.
- [ ] O layout não salta.
- [ ] O componente respeita `prefers-reduced-motion`.
- [ ] O componente funciona por teclado.
- [ ] O foco permanece visível.
- [ ] O estado assíncrono possui feedback local.
- [ ] Erros possuem ação de recuperação.
- [ ] O componente não dispara múltiplas ações simultâneas.
- [ ] O comportamento foi testado em conexão lenta.
- [ ] O comportamento foi testado com dados vazios.
- [ ] O comportamento foi testado com conteúdo longo.
- [ ] O comportamento foi testado em dispositivos menores.

## Toast

- [ ] O mesmo toast evolui entre loading, progress, success e error.
- [ ] O toast não é recriado a cada estado.
- [ ] A barra usa progresso real quando disponível.
- [ ] Existe fallback indeterminado.
- [ ] Erros críticos permanecem visíveis.
- [ ] Ações reversíveis possuem undo.
- [ ] Toasters repetidos são agrupados.
- [ ] A saída ocorre após tempo suficiente para leitura.

---

# 51. Regras proibidas

É proibido:

- animar tudo indiscriminadamente;
- usar `transition: all`;
- adicionar delay em interações primárias;
- usar bounce em componentes corporativos;
- animar texto com movimento exagerado;
- usar shake repetitivo;
- esconder loading em operações longas;
- usar porcentagem falsa;
- desmontar conteúdo anterior durante refetch;
- trocar estados sem transição quando isso gera ruptura;
- criar uma animação exclusiva para cada tela;
- ignorar reduced motion;
- bloquear interação durante animações não críticas;
- usar animação como substituto de hierarquia visual;
- usar movimento para esconder lentidão real;
- manter spinners ativos após conclusão;
- animar grandes listas item por item;
- reanimar toda a página em atualizações locais.

---

# 52. Padrão de decisão

Antes de adicionar animação, classificar a mudança:

## Mudança visual simples

Usar:

- transition de cor;
- opacity;
- transform curto.

## Mudança de conteúdo

Usar:

- crossfade;
- AnimatePresence;
- preservação de dimensões.

## Mudança estrutural

Usar:

- layout animation;
- collapse;
- drawer;
- modal;
- shared layout.

## Mudança assíncrona

Usar:

- feedback local;
- toast progressivo;
- loading;
- sucesso;
- erro;
- rollback.

## Mudança frequente

Usar:

- highlight curto;
- interpolação;
- evitar animação completa.

---

# 53. Padrão final do dashboard

O dashboard deve transmitir:

- resposta imediata;
- continuidade;
- previsibilidade;
- precisão;
- estabilidade;
- contexto;
- progresso;
- conclusão;
- capacidade de recuperação.

Cada animação deve responder a uma pergunta concreta do usuário:

- O sistema recebeu minha ação?
- O que está acontecendo?
- Onde a mudança ocorreu?
- Quanto falta?
- A ação terminou?
- O resultado foi salvo?
- O que falhou?
- O que posso fazer agora?
- Posso desfazer?
- O sistema continua funcionando?

Se a interface não responde claramente a essas perguntas, a implementação está incompleta.
