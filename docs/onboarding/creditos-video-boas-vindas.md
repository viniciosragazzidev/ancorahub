# Vídeo de boas-vindas do corretor: créditos e licenças

Arquivos no app: `public/onboarding/video/boas-vindas-celular.mp4`, `boas-vindas-computador.mp4` e os pôsteres. Mostrado no primeiro acesso do corretor ao Lite quando a flag `feature_welcome_video_enabled` está ligada (Super-admin) **e** a empresa do corretor está na variável `WELCOME_VIDEO_TENANT_ID` (um ou mais ids separados por vírgula) (Coolify, em tempo de execução). Sem a variável, o vídeo não aparece para ninguém. A restrição garante o uso interno só na Âncora (ver a licença abaixo).

| Parte | Origem | Licença / condição |
|---|---|---|
| Narração (voz "Liam", premade, modelo `eleven_multilingual_v2`) | ElevenLabs, conta do Vinicios no plano **Free** | O plano Free da ElevenLabs **não inclui uso comercial**. Decisão do Vinicios (2026-10-12): uso **interno**, só para os corretores da Âncora, sem uso comercial. |
| Efeitos sonoros (toque, pop, swoosh, whoosh, sucesso, notificação, brilho, impacto etc.) | ElevenLabs text-to-sound-effects, mesma conta Free | Mesma condição da narração. |
| Música "Cat Walk" (Arulo) | Mixkit (assets.mixkit.co/music/175) | Mixkit License: gratuita, inclusive para uso comercial, sem atribuição obrigatória. |
| Animação e telas | Feitas no projeto (HyperFrames + design do modo Lite) | Próprias. |

## Antes de qualquer uso comercial

Se o vídeo (ou outro feito com essa voz e esses efeitos) for usado fora da Âncora, por exemplo no CorreTop vendido a outras corretoras, em anúncio ou em site público, **assinar um plano pago da ElevenLabs** (Starter ou acima concede licença comercial) e gerar de novo a narração e os efeitos nesse plano.

## Onde está o projeto-fonte

Fora do git (`/video/` no `.gitignore`): `video/boas-vindas/hf-v2/` (HyperFrames, versão 2 em plano contínuo), `video/boas-vindas/audio-v2/` (música e efeitos) e `video/boas-vindas/desktop/` (composição 16:9). Plano completo: `docs/implementations/active/2026-10-12-video-boas-vindas.md`.
