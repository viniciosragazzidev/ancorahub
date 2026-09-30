# Reativação de lead frio e observação de investigação

Estado: concluído no código; pendente homologação operacional da WABA.
Decisões: DEC-128; regras BR-073/074; requisito RF201.

## Escopo entregue

- Regra por tenant criada/ativada por padrão para um único reenvio após duas
  horas da conclusão da qualificação, apenas em dias úteis, das 08h às 18h em
  `America/Sao_Paulo`. A criação e a migração pontual de regra legada são
  auditadas; uma pausa posterior do tenant é preservada.
- Follow-up restrito a lead frio elegível, sem corretor, não encerrado, removido,
  em hold, arquivado, excluído, com opt-out ou número inválido. O envio requer
  template `FIRST_CONTACT` aprovado na WABA oficial. A guarda é repetida no
  outbox antes do provedor e adia mensagens fora da janela permitida.
- Resposta antes da atribuição cancela ofertas/follow-up pendentes e reabre a
  qualificação salva. Depois de atribuída a corretor, envia um aviso único e
  não inicia IA. A gestão/investigação não recebe esse fluxo.
- Kill switch global auditado em Super-admin, ativado por padrão e desligável;
  regra do tenant também pode ser pausada.
- Drawer compartilhado de detalhes do lead consulta sob demanda o motivo já
  existente da investigação, apenas para Diretor/Gerente, com escopo de tenant
  e auditoria de leitura. Nenhum campo ou migration de banco foi adicionado.

## Principais áreas

`src/features/ai-qualification/`, `src/features/qualification-engine/`,
`src/features/communication-channels/`, `src/features/leads/`,
`src/app/(platform-admin)/super-admin/`, `src/shared/feature-flags/` e
`src/app/api/internal/jobs/qualification-timeout/`.

## Validação

- `npm run type-check`: passou.
- Testes focados: 7 arquivos, 16 testes passaram.
- `npm test`: 233 arquivos passaram, 7 ignorados; 1.278 testes passaram, 10
  ignorados e 2 falharam. Reexecutados isoladamente: dashboard operacional passou;
  persiste uma falha fora das áreas alteradas no contrato de navegação Lite
  (`broker-lite-experience.test.tsx`).
- `npm run lint`: terminou sem erros; reportou 1.106 avisos no repositório.
- `npm --ignore-scripts run build`: build Next.js, TypeScript e geração de páginas
  passaram. `npm run build` completo não passou no prebuild da extensão por
  acesso negado do sandbox ao diretório `../../../..`.
- `npm run agent:verify -- --level fast` e `--level full`: não iniciaram as
  verificações; o Node falhou em `uv_os_get_passwd returned ENOMEM`.
- Não houve envio real nem homologação com a Meta/WABA neste ambiente.

## Implantação, riscos e rollback

Confirmar que o cron existente chama `/api/internal/jobs/qualification-timeout`,
que o tenant tem canal oficial Meta ativo e `FIRST_CONTACT` aprovado/sincronizado
na WABA correta. A indisponibilidade do template/canal bloqueia e audita o envio,
sem fallback de texto livre. Para interromper imediatamente, desativar a flag
global `feature_cold_lead_reactivation_enabled`; cada tenant também pode pausar
sua regra. Histórico/outbox não é apagado.
