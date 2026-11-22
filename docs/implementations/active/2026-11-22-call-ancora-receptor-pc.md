# Call Âncora: celular como receptor do computador

Estudo de viabilidade e plano, 22/11/2026. Ainda sem código. Continua o plano `2026-11-19-call-ancora.md` (discador próprio, só o plano do chip, sem VoIP).

## 1. O pedido

O celular Android da Âncora fica escondido atrás do computador, ligado a ele. O corretor usa um fone com microfone no computador:

- ouve no fone do computador o áudio da ligação feita pelo chip do celular;
- fala no microfone do computador e a voz vai para a ligação, ao mesmo tempo, como num VoIP;
- para ele, tudo acontece no CRM do computador: iniciar, atender, ver o estado e desligar.

As duas formas continuam valendo: **fone no celular** (como hoje) ou **fone no computador** (novo), com troca pelo CRM.

## 2. O limite do Android que decide tudo

Desde o Android 10, nenhum app comum consegue **ler** o áudio da ligação de operadora (`VOICE_CALL`, `VOICE_DOWNLINK`, `VOICE_UPLINK` exigem `CAPTURE_AUDIO_OUTPUT`, que é só de app de sistema). E **nenhum** app, nem de sistema, tem API pública para **injetar** áudio na voz que sai para o cliente: o que vai para a ligação é o que o modem recebe da rota de áudio ativa (microfone do aparelho, fone com fio, fone USB ou fone Bluetooth).

Ser o discador padrão (o que o app já é) não muda isso: dá controle da ligação e da **rota** de áudio, não do áudio em si.

Conclusão: a ponte não pode ser "o app pega o som e manda pela rede". Ela precisa fazer o computador **parecer um fone** para o celular, e o próprio Android leva a ligação até ele.

## 3. Caminhos avaliados

| Caminho | Funciona? | Por quê |
|---|---|---|
| **Bluetooth HFP: o computador vira o "fone Bluetooth" do celular** (recomendado) | Sim, nos dois sentidos | É o mesmo mecanismo de um fone Bluetooth ou do som do carro. O Android manda a ligação pelo canal de voz Bluetooth (SCO) e recebe o microfone por ele. O Windows 11 já faz o papel de fone via **Vincular ao Celular (Phone Link)**, que exige Bluetooth com HFP no computador. O nosso app, como discador padrão, escolhe a rota (`ROUTE_BLUETOOTH` ou fone/aparelho). |
| USB com placa de som USB-C + cabos de áudio até o computador | Sim, mas com gambiarra de hardware | O celular trata a placa como fone USB e manda a ligação para ela; dois cabos P2 levam o som à entrada de linha do computador e trazem o microfone de volta. Exige comprar placa e cabos, computador com entrada de linha, programa no Windows para mandar o microfone do fone para a saída do cabo, ajuste de volume (ruído e eco) e ocupa a porta de carga do celular. Fica como plano B. |
| USB "acessório de áudio" do Android (AOA 2.0) | Não | Removido no Android 8. |
| ADB pelo cabo (ex.: scrcpy com `voice-call-downlink`) | Só metade | Como o ADB roda com mais permissão, alguns aparelhos deixam **ouvir** a ligação no computador. Mas a voz do computador não chega ao cliente: não existe injeção no uplink. Também exige depuração USB ligada sempre. Descartado. |
| Wi-Fi / WebRTC entre o app e o CRM no navegador | Não | Depende de o app capturar e injetar o áudio da ligação, o que o Android bloqueia (seção 2). Só com root ou app de sistema assinado pelo fabricante, fora de cogitação num aparelho corporativo comum. |
| Caixinha Linux (Raspberry Pi) fazendo o papel de fone Bluetooth e repassando por WebRTC ao navegador | Sim, mas é compra e manutenção | Plano C, só se o Bluetooth do Windows falhar e o plano B não servir. |
| VoIP / tronco SIP / gateway GSM | Fora | Já descartados pelo dono: custo por minuto ou equipamento e bloqueio de chip. |

## 4. Arquitetura escolhida

```
 Fone com microfone ── Computador (Windows 11)                 Celular Android da Âncora (atrás do PC)
                       │  Phone Link = "fone Bluetooth"  ◄── Bluetooth HFP (voz) ──►  App Call Âncora (discador padrão)
                       │  Navegador: CRM /call-ancora                                   │  escolhe a rota: computador / celular
                       │                                                                │  liga, atende, desliga, mudo
                       └──────── HTTPS ──► AncoraHub (Coolify) ◄── HTTPS (já existe) ───┘
                                           sessão, fila, comandos e estado
                       Cabo USB do computador ao celular: só para carregar.
```

- **Voz:** só pelo Bluetooth, direto entre celular e Windows. O navegador e o servidor nunca tocam no áudio. Sem gravação, como já combinado.
- **Comandos e estado:** pelo canal que já existe (`/api/call-ancora/device/*`). A web manda o comando para o servidor, o celular lê na próxima consulta (hoje a cada 1 s com ligação) e responde com o estado.
- **Troca de saída:** o CRM tem "Ouvir no: Computador | Celular". O app aplica com `setAudioRoute` (até Android 13) ou `requestCallEndpointChange` (Android 14+), que o discador padrão pode usar. Com fone ligado no celular, a rota "Celular" usa o fone com fio; sem ele, o próprio aparelho.
- **Queda do Bluetooth no meio da ligação:** o Android volta sozinho para o celular. O app avisa o CRM, que mostra "Fone do computador desconectado: a ligação foi para o celular", com "Tentar de novo".

### O que o computador precisa

- Windows 11 com Bluetooth que tenha **"Telefonia mãos-livres"** (Hands-Free) no Gerenciador de Dispositivos. Notebooks quase sempre têm; desktop sem Bluetooth precisa de um adaptador USB que suporte HFP (alguns só fazem áudio estéreo e não servem). É a única compra possível, pequena e única.
- **Phone Link** (já vem no Windows) pareado com o celular, com as chamadas ativadas. Ele exige Android 10 ou mais novo e o app "Vincular ao Windows" no celular. Gratuito, mas pede conta Microsoft. As janelas de chamada dele ficam escondidas; a tela de uso é o CRM.
- O fone do corretor como **dispositivo de comunicação padrão** do Windows.
- Cabo USB só de carga, e o celular sem otimização de bateria para o app (já é serviço em primeiro plano durante a ligação).

### Permissões novas no app

- `BLUETOOTH_CONNECT` (Android 12+), pedida no checklist "Preparar o celular" como novo item: **"Computador conectado por Bluetooth"**.
- Nada de permissão especial, root ou app de sistema.

## 5. Integração com o CRM

1. **Estado do áudio** no estado do celular que o CRM já lê: rota atual (`computador`, `celular`, `fone no celular`, `viva-voz`), se o computador está conectado e se está no mudo.
2. **Comandos novos** em `control`: `route_computer`, `route_phone`, `mute`, `unmute`, `hangup`, `answer`. Hoje a rota aceita `pause`, `resume`, `skip`, `end`.
3. **Tela `/call-ancora`** (no padrão Lite e na densidade enxuta): no cartão da ligação ativa, um seletor compacto "Ouvir no ▾ Computador / Celular", o botão de mudo e o Desligar que já existe. Selo discreto "Fone do computador conectado" ou o aviso quando cair. Troca de saída é feedback nível 1 (visual, sem som).
4. **Preferência por corretor:** a escolha fica guardada e vale para as próximas ligações. Padrão: computador, quando estiver conectado.
5. **Ligação recebida** (o cliente retornando para o chip): o CRM mostra "Chamada recebida" com Atender e Recusar. Para não esperar a consulta de 1 s, o celular manda o evento de tocando na hora e o CRM passa a consultar mais rápido enquanto houver chamada tocando.
6. **Tudo que hoje é só no celular** (Pausar, "Segure para encerrar", checklist) precisa ter equivalente no CRM ou ficar resolvido na instalação, porque ninguém vai tocar no aparelho.
7. **Laboratório** (`/dev/laboratorio`): o roteiro simulado ganha a troca de saída e a queda do Bluetooth.
8. **Painel do diretor:** por estação, "Áudio no computador" ou "no celular" e o último aviso de queda.

## 5A. "Celular Call Âncora": o app vira a cara do aparelho

Pedido do dono (22/11/2026): ao abrir, o app ocupa o celular e impede, ou pelo menos dificulta, que o corretor saia dele e use o aparelho para outras coisas.

| Nível | O que trava | O que exige |
|---|---|---|
| **1. Launcher (tela inicial)** | O botão Início sempre volta para o Call Âncora; não há gaveta de apps | Só declarar o app como `HOME` e escolhê-lo como tela inicial. Fácil de desfazer: a barra de notificações e os Ajustes continuam abertos. |
| **2. Fixar tela (screen pinning)** | Início e Recentes ficam travados até o gesto de desafixar | Recurso comum do Android. Quem conhece o gesto sai (pode pedir PIN para sair, mas ainda sai). |
| **3. Modo quiosque com o app como Device Owner** (recomendado) | Barra de status, notificações, Início, Recentes e Ajustes bloqueados; só os apps da lista abrem; sem desinstalar, sem instalar outros, sem redefinir de fábrica pelo menu | O app vira "dono do dispositivo" (`DevicePolicyManager`, `startLockTask` com lista de apps permitidos). Gratuito, sem MDM pago. Exige **celular zerado e sem conta Google** na hora de ativar, por um comando ADB feito uma vez pelo computador (`dpm set-device-owner`). |

Recomendado: **nível 3**, porque o aparelho é da Âncora e dedicado. Ganhos extras do Device Owner, úteis para o celular escondido:

- conceder sozinho as permissões do checklist (ligar, estado do telefone, notificação, Bluetooth), sem ninguém tocar na tela;
- tela sem bloqueio e sempre acesa enquanto carrega (`setKeyguardDisabled`, `STAY_ON_WHILE_PLUGGED_IN`);
- Bluetooth sempre ligado e o app sempre aberto depois de reiniciar;
- bloquear instalar apps, depuração USB, redefinição pelo menu e troca de discador padrão.

Saída de emergência: no app, "Sair do modo Call Âncora" só com PIN do diretor (ou comando do CRM pelo diretor), para manutenção. Desfazer de vez = o próprio app remover o Device Owner, ou redefinir de fábrica.

Cuidados:
- O "Vincular ao Windows" (lado celular do Phone Link) entra na lista de apps permitidos; a conta Microsoft é configurada antes de travar.
- Ativar o Device Owner apaga nada se o celular já estiver zerado, mas **não** funciona num celular já em uso com conta: precisa zerar antes. Atualizar o APK depois passa a ser pelo próprio app (baixando do AncoraHub) ou por ADB.
- Alguns fabricantes (Samsung, Xiaomi) têm telas próprias que escapam do quiosque em versões antigas; testar no modelo escolhido.

## 6. Riscos

| Risco | Efeito | Como tratar |
|---|---|---|
| Phone Link e Bluetooth do Windows instáveis | Áudio cai ou não conecta | Fase 0 testa no computador real antes de qualquer código. Queda volta sozinha para o celular e o CRM avisa. |
| Adaptador sem HFP | Só som estéreo, sem microfone | Conferir "Telefonia mãos-livres" no Gerenciador; lista de adaptadores aprovados. |
| Qualidade do Bluetooth | CVSD em 8 kHz soa como telefone antigo; mSBC (16 kHz) soa como a ligação normal | Testar se o par celular + computador negocia mSBC. Mesmo em 8 kHz o cliente ouve normal: o limite é a própria ligação. |
| Latência | Bluetooth soma algo como 30 a 60 ms em cada sentido sobre a ligação celular | Fica perto de um fone Bluetooth comum; medir na fase 0. |
| Eco | O cliente ouve a própria voz | Com fone fechado, o eco é mínimo. Desligar no Windows a redução de volume em comunicação e os "aprimoramentos" do fone se atrapalharem. Viva-voz no computador fica fora. |
| Phone Link mostrando a própria janela de chamada ou puxando chamadas que não são do Call Âncora | Confusão para o corretor | Ocultar as notificações dele; o celular é só do Call Âncora. |
| Interferência com várias estações na mesma sala | Áudio picotado | Um par celular e computador por estação, pareamentos sem cruzar; testar com duas estações antes de escalar. |
| Quiosque exige celular zerado | Aparelho em uso precisa ser redefinido | Ativar o quiosque na entrega do celular, antes de qualquer conta. |
| Conta Microsoft no computador | Dependência externa (gratuita) | Usar a conta da empresa; avaliar alternativa sem Phone Link só se ele não servir. |
| Comandos pelo polling de 1 s | Atraso perceptível em atender | Consulta mais rápida enquanto toca (item 5.5); trocar por SSE só se a fase 3 mostrar necessidade. |
| Sessão aberta "Call Âncora limpo" mexendo nos mesmos arquivos (`CrmPanel.kt`, `MainActivity.kt`, `call-ancora-workspace.tsx`) | Conflito de merge | As fases 1 e 2 só começam depois que essa sessão juntar o trabalho em `preview/3005`. |

## 7. Fases

**Fase 0. Prova sem código (meia hora, no computador e celular reais).**
Parear o celular com o Windows pelo Phone Link com chamadas ativadas, ligar pelo Call Âncora e conferir: o áudio chega ao fone do computador, a voz chega ao cliente, a qualidade, o eco e o atraso. Testar também tirar o Bluetooth no meio da ligação. Se não funcionar, decidir entre o plano B (placa USB e cabos) e o plano C (caixinha Linux) antes de seguir.

**Fase 1. App Android: rota de áudio.**
Ler as saídas disponíveis (`onCallAudioStateChanged` / `onAvailableCallEndpointsChanged`), aplicar a rota preferida no início de cada ligação, aceitar os comandos de rota e mudo, reportar a rota e as quedas, novo item no checklist com `BLUETOOTH_CONNECT`. Teste unitário da regra de escolha da rota.

**Fase 2. CRM: troca de saída e estado.**
Comandos novos em `control`, campos de áudio no estado do celular, seletor "Ouvir no" e mudo no cartão da ligação, aviso de queda, preferência por corretor, roteiro do laboratório. Testes em `device-routes.test.ts`.

**Fase 3. Chamada recebida pelo CRM.**
Evento de tocando na hora, Atender e Recusar no CRM, consulta rápida enquanto toca.

**Fase 3A. Celular Call Âncora (quiosque).**
Launcher (`HOME`), `DeviceAdminReceiver` com Device Owner, `startLockTask` com lista de apps permitidos, permissões concedidas pelo próprio app, tela acesa carregando, sem bloqueio, saída com PIN do diretor. Pode ser feita em paralelo às fases 1 e 2, porque mexe em outros arquivos (manifesto, receptor novo e a tela de entrada). Testar no celular zerado do dono.

**Fase 4. Instalação por estação.**
Guia curto (parear, Phone Link, fone padrão de comunicação, ocultar notificações, cabo de carga, bateria), status da estação no painel do diretor e teste com duas estações lado a lado.

## 8. Decisões

Seguindo a opção recomendada em cada ponto:

1. Ponte por Bluetooth HFP com o Windows (Phone Link) como fone. Plano B: placa USB e cabos. Plano C: caixinha Linux.
2. Saída padrão: computador quando conectado; celular como reserva automática.
3. Celular em modo quiosque com o app como Device Owner (nível 3), com saída por PIN do diretor.
4. Fase 0 antes de qualquer código; as fases 1 e 2 depois da sessão "Call Âncora limpo".
