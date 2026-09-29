# Balanceamento automático entre unidades

**Estado:** implementação em validação
**Decisão:** DEC-117
**Escopo:** equalizar futuras entradas automáticas dentro do conjunto de unidades elegíveis, sem alterar destinos fixos ou reatribuir leads históricos.

## Diagnóstico

- O painel `/dashboard` agrupa todos os leads não arquivados/não excluídos por unidade dentro do período selecionado (`createdAt`).
- O roteador anterior escolhia pela quantidade de leads em etapas comerciais ativas, não pela quantidade recebida; leads em `new`/`queued` e encerrados não pesavam na escolha.
- O balanceamento só ocorria quando não havia uma unidade pré-resolvida. Políticas com várias unidades permitidas passavam todas ao ranking de corretores, que prioriza escala, carga sem atendimento, carga ativa e desempenho, sem uma meta de participação por unidade.
- A seleção e a gravação da unidade não eram serializadas entre workers; processamentos concorrentes podiam escolher com base no mesmo retrato antigo.
- A imagem isolada não permite atribuir percentuais a campanhas, regras fixas ou ações manuais. Isso exige auditoria dos eventos e das origens do tenant.

## Implementação

- Escolher a unidade elegível com menor volume recebido, contando leads não arquivados/não excluídos em todos os estados e filas do tenant.
- Balancear quando há mais de uma unidade elegível, inclusive quando a política permite várias; manter unidade única explícita e ações manuais inalteradas.
- Serializar leitura do volume e atribuição da unidade com advisory transaction lock por tenant; a atualização da unidade, evento de distribuição e auditoria ficam na mesma transação.
- Aplicar exclusões de unidade da política antes da escolha; se nenhuma unidade elegível existir, manter o lead aguardando com motivo.
- Não mover leads já recebidos. As diferenças históricas são corrigidas gradualmente conforme novas entradas elegíveis chegam.

## Verificações

- [ ] Testes de regressão focados.
- [ ] Type-check e lint.
- [ ] `npm run agent:verify -- --level fast` e `--level full`.
- [ ] `npm run build`.
- [ ] Revisão do diff e `git diff --check`.
- [ ] Monitorar eventos `auto_routed_to_unit` após publicação e comparar unidades no mesmo período/escopo.

## Risco e reversão

Regras com conjuntos de unidades diferentes não podem ter participação exatamente igual entre si; uma campanha ou fila explicitamente vinculada a uma unidade continua direcionada àquela unidade. Reverter o código restaura a distribuição anterior, mas não deve apagar eventos/auditoria nem reatribuir leads já recebidos.
