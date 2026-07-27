# Guia de UX — Onboarding

> Referência adaptada do Tangram Design System (RD Station) para o CorreTop.
> Complementa `docs/route-onboarding-pattern.md` e `docs/setup-tutorial-pattern.md`,
> que descrevem a implementação técnica. Este documento trata de **quando** usar,
> **como estruturar** e **como escrever** os fluxos de onboarding.

---

## Quando fazer (e quando não fazer)

### Faça onboarding quando:
- A feature ou fluxo exige configuração não-trivial antes do primeiro uso.
- O contexto de uso é difícil de inferir sem orientação (ex: configuração de AI, integração com WhatsApp).
- O erro de configuração tem consequência operacional real (ex: lead sem atendimento).

### Não faça onboarding quando:
- O produto ou feature é autoexplicativo.
- O conteúdo não tem propósito real — onboarding vazio piora a percepção do produto.
- Não há um fluxo guiado definido. Melhor uma tooltip contextual do que um modal genérico.

> **Referência NNgroup**: onboarding frequentemente falha porque interrompe a tarefa,
> sobrecarrega a memória e não é memorável. Tooltips e ajuda contextual são mais
> eficazes na maioria dos casos.

---

## Anatomia de um bom onboarding

Um onboarding do CorreTop deve seguir esta ordem:

1. **Saudação ou boas-vindas** — contextualiza a interrupção, não é genérico.
2. **Visão geral** — apresenta o valor do produto/feature em uma frase.
3. **Passo a passo** — guia o usuário até executar a primeira ação principal.
4. **(Opcional) Personalização** — entende o perfil do usuário para adaptar a jornada.

---

## Estrutura de telas

### Número de telas
- Mínimo: 1 (modal simples com contexto + CTA).
- Máximo recomendado: 4–5 passos. Mais que isso, revisar se o onboarding é o formato correto.
- Cada tela tem **um objetivo**. Não acumule informações de múltiplas etapas em uma tela.

### Progressão
- Bloqueie o avanço somente quando a ação anterior for pré-requisito real.
- Sempre permita dispensar (fechar) o onboarding — forçar não funciona.
- Grave o progresso no servidor (`route_onboarding_progress`) — nunca em localStorage.

---

## Como escrever

### Título
- Objetivo: contextualizar **por que** o usuário foi interrompido.
- Deve ser direto, sem flores. Não use "Bem-vindo" ou "Olá" genérico toda vez.
- Exemplos aprovados:
  - "Esta é a [feature]!"
  - "Conheça a [feature] do CorreTop"
  - "Descubra as vantagens de usar [feature]"
  - "Configure o [recurso] antes de começar"

### Texto descritivo
- Responda: **para que serve?**, **que dor resolve?**, **por que o usuário precisa disso agora?**
- Seja breve — 2 a 3 frases no máximo.
- Exemplos aprovados:
  - "Com a Qualificação por IA você reduz o tempo de triagem de leads e foca nos contatos com maior potencial de fechamento."
  - "O Plantão garante que nenhum lead fique sem atendimento fora do horário comercial. Configure os turnos da equipe em menos de 2 minutos."

### Maiúsculas
- Capitalize o início de cada termo relevante em nomes de features: "Distribuição Automática", "Qualificação por IA".
- Preposições e conjunções não são capitalizadas: "Gestão de Leads", não "Gestão De Leads".

### "Meu" vs "Seu"
- Tudo dentro do contexto do usuário usa "Meu/Minha": "Meu Perfil", "Minha Jornada".
- Evite "Seu/Sua" quando o contexto é claramente da pessoa autenticada.

### Tom de voz
| Contexto | Tom |
|---|---|
| Novo recurso, momento de descoberta | Mais animado, mas sem exagero |
| Configuração técnica | Educativo, preciso, sequencial |
| Usuário em urgência ou tensão | Direto ao ponto, reduza o esforço cognitivo |

---

## Componentes a usar

| Cenário | Componente |
|---|---|
| Introdução a uma rota nova (primeira visita) | `RouteOnboardingDialog` — ver `docs/route-onboarding-pattern.md` |
| Configuração de múltiplas etapas em sequência | `SetupTutorialDialog` — ver `docs/setup-tutorial-pattern.md` |
| Dica contextual pontual (sem bloqueio de fluxo) | `Tooltip` com `Popover` de ajuda |
| Anúncio de nova feature para usuários existentes | Modal simples com `Dialog`, **não** onboarding completo |

> Nunca crie um dialog, modal ou stepper local para onboarding sem antes
> verificar se `RouteOnboardingDialog` ou `SetupTutorialDialog` já atendem o caso.

---

## Exceções — quando **não** usar o padrão modal

Use a **Navbar simples** (sem Shell, sem onboarding modal) em:
- Páginas de login e recuperação de senha.
- Páginas de erro (4xx, 5xx).
- Editores de documentos ou canvas.
- Fluxos de cadastro de tenant/conta.

---

## Checklist antes de criar um onboarding

- [ ] A feature é realmente difícil de usar sem orientação?
- [ ] O número de telas está em ≤ 4–5?
- [ ] Cada tela tem **um** objetivo claro?
- [ ] O usuário pode dispensar o onboarding a qualquer momento?
- [ ] O progresso é salvo no servidor, não em localStorage?
- [ ] O conteúdo tem `prefers-reduced-motion` aplicado nas animações?
- [ ] O copy passa pelo checklist de tom de voz acima?
- [ ] O Super-admin pode reiniciar o onboarding por usuário em `/super-admin/onboarding`?
