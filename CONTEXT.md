# Contexto de domínio do CorreTop

## Atendimento e pós-venda

- **Lead**: oportunidade comercial e unidade de atendimento; pode representar uma família.
- **Contexto de propriedade**: identifica o corretor responsável e a unidade responsável por um registro operacional. Para o Diretor, a unidade deve aparecer sempre que a visualização puder reunir mais de uma filial; um registro sem filial é explicitamente geral/sem unidade.
- **Beneficiário**: pessoa incluída na contratação de um lead. Todo lead deve ter um titular; dependentes são beneficiários adicionais.
- **Titular**: beneficiário marcado como responsável principal pela contratação. Há exatamente um titular por lead.
- **Cotação**: versão histórica e imutável de uma proposta para um lead; seus itens detalham plano, beneficiário e valor calculado.
- **Catálogo oficial**: base de operadoras, planos, tabelas e versões comerciais mantida pela plataforma. Não pertence a uma corretora e somente o Super-admin pode publicá-la.
- **Extensão privada de catálogo**: operadora ou plano de acordo exclusivo de uma corretora. Pertence a exatamente um tenant, não é compartilhável e pode ser administrada apenas pelo Diretor desse tenant.
- **Tabela comercial**: identidade lógica das condições de um plano; não é o preço em si.
- **Versão de tabela**: publicação imutável de uma tabela comercial, com vigência e valores por faixa. Cotação, venda e PDF devem guardar a versão usada.
- **Disponibilidade de catálogo**: decisão administrativa que habilita um plano oficial para um tenant e, opcionalmente, o restringe em uma unidade. Uma restrição nunca reabilita um item oculto acima dela.
- **Documento por beneficiário**: evidência individual, como identidade ou declaração de saúde. Documentos familiares, como comprovante de residência, não precisam apontar para uma pessoa.
- **Venda**: registro da contratação aprovada pela operadora; a data de registro, o início da vigência e o valor aprovado são fatos diferentes.
- **Cliente ativo**: vínculo pós-venda criado a partir de uma venda aprovada, com vigência e aniversário contratual próprios.
- **Cancelamento**: encerramento do cliente ativo informado à corretora; não desconta dinheiro automaticamente e gera pendências financeiras auditáveis.
- **Estorno pendente**: sinalização de uma parcela já paga que pode estar dentro da janela de chargeback; sua resolução é manual.

## Canais de comunicação

- **Canal de comunicação**: identidade operacional de um provedor associada a um tenant e, opcionalmente, a uma unidade. Para WhatsApp oficial, a chave externa é o `phone_number_id` da Meta.
- **Canal Meta Cloud**: canal empresarial conectado por Embedded Signup; seu token é cifrado no servidor e nunca é devolvido ao navegador.
- **Canal legado OpenWA**: conexão temporária por QR Code mantida apenas durante a migração. Não deve receber novas capacidades estruturais.
- **Atendimento externo temporário**: enquanto o chat interno não estiver operacional, o Corretor inicia o atendimento auditado no CorreTop e é direcionado ao WhatsApp pessoal pelo número autorizado do lead. A interface não apresenta mensagens como se estivessem sincronizadas.
