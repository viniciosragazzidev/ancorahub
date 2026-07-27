# Plano — Catálogo Global de Operadoras e Planos

**Estado:** em implementação — fundação entregue em 2026-07-16.  
**Dono do catálogo:** Super-admin CorreTop.  
**Decisão:** DEC-031.

## Visão geral

O catálogo passa a ser um domínio de plataforma. Operadoras, planos, tabelas, faixas, preços e a própria disponibilidade comercial terão uma única fonte de administração: o Super-admin. Tenant e unidade somente consomem a disponibilidade efetiva definida na área administrativa da plataforma.

```text
Super-admin (catálogo e disponibilidade) → tenant/unidade consumidores → corretor → cotação versionada
```

O preço não pertence ao plano: uma cotação escolhe uma **versão publicada de tabela**. Propostas, PDFs, vendas e documentos mantêm snapshot dessa versão, de modo que a publicação de uma tabela nova nunca altere uma proposta antiga.

## Problemas da arquitetura atual

`carriers`, `carrier_plans`, `carrier_plan_prices` e `carrier_plan_networks` possuem `tenant_id`. Hoje o Diretor pode criar, editar, ativar, inativar e excluir operadoras, planos e preços. Não há identidade global, vigência, versão publicada ou importação controlada.

Dependências atuais a migrar:

| Área | Dependência | Evolução |
|---|---|---|
| `/catalogo`, `src/features/catalog/actions.ts` | CRUD por Diretor | Disponibilidade comercial; CRUD migra para Super-admin. |
| Cotador, `/cotacoes`, `/leads/[id]` | planos/preços por tenant | Resolver de catálogo global + tenant/unidade. |
| `/leads`, `/conversas` | listas de plano ativas do tenant | Mesma interface pública do resolver. |
| Documentos, comissões, vendas e financeiro | IDs de plano/operadora do tenant | Identidades globais estáveis, regras comerciais ainda isoladas por tenant. |
| Proposta pública, PDF e detalhe da cotação | join com plano vivo | Snapshot primeiro; join vivo apenas como fallback legado. |

RF141–142 e BR-030 descrevem catálogo híbrido. A decisão revisada preserva esse caso apenas como **extensão privada da corretora**: ela pode cadastrar internamente uma operadora e planos de acordo exclusivo, mas esses itens não entram no catálogo oficial, não são compartilhados com outros tenants e não podem ser alterados pela IA ou por outro tenant.

## Objetivos

- Operadoras nacionais e regionais, centenas de planos e milhares de tabelas.
- Vigência, descontinuação, versões e histórico sem exclusão física.
- Importação CSV/XLSX agora; API e scraping futuramente pelo mesmo contrato.
- Habilitação, ocultação, favoritos e ordenação por tenant; restrição adicional por unidade.
- Cotação, proposta, venda, documento e comissão consistentes com a versão usada.
- Extensão privada controlada para acordos exclusivos de uma corretora, sem contaminar a base oficial.
- Auditoria, RBAC, feature flag global e consultas indexadas.

Não fazem parte desta primeira implementação: scraping, API de operadoras e recomendação por IA autônoma. O pipeline de IA continuará somente como proposta revisável pelo Super-admin.

## Estado de implementação — 2026-07-16

**Entregue nesta fase:** migration `0045_global_catalog_foundation`, entidades globais e privadas, versão comercial, preço por faixa, allow-list por tenant, restrição por unidade, auditoria, import batches/change sets, feature flags globais, contrato `listAvailableCatalogPlans()`, `/super-admin/catalogo` e `/catalogo/interno`. Os dados legados são copiados idempotentemente como extensão privada para preservar IDs e histórico durante a transição.

**Próxima fatia obrigatória:** mudar cotador, documentos, vendas, comissões, PDF e proposta pública para o resolvedor e snapshots de versão. Até essa migração, o CRUD legado é compatibilidade; ele não deve receber novas funcionalidades.

## Nova arquitetura

`GlobalCatalog` é dono de identidade, tabelas, preços, importação, publicação e disponibilidade por tenant/unidade. Páginas, plugins, IA e API consomem serviços; nunca consultam tabelas diretamente.

```text
Página / Plugin / API / IA
  → CatalogAvailabilityService(tenant, unidade, papel)
  → GlobalCatalogQueryService(somente publicado e vigente)
  → repositórios → banco
```

Interfaces públicas:

```ts
listAvailableCatalogPlans({ tenantId, branchId, filters, cursor })
getQuotableTableVersion({ tenantId, branchId, planId, quoteDate, profile })
createCatalogImportDraft(input)
validateCatalogImport(importId)
publishCatalogVersion(versionId)
setTenantCatalogAvailability(input)
setBranchCatalogRestriction(input)
```

Eventos: `catalog.imported`, `catalog.version.published`, `catalog.version.archived`, `catalog.availability.changed`, `catalog.table.expiring` e `catalog.table.expired`.

## Modelagem sugerida

| Entidade | Papel e campos essenciais |
|---|---|
| `global_carriers` | Identidade da operadora: `id`, nome, razão social, código ANS, status, arquivamento, ator e timestamps. |
| `global_plans` | Produto sem preço: `id`, `carrier_id`, nome/código, categoria, segmentação, cobertura, acomodação, coparticipação, atributos e status. |
| `catalog_price_tables` | Identidade lógica de uma tabela comercial: plano, nome/código, categoria e escopo. |
| `catalog_table_versions` | Unidade imutável de publicação: tabela, número da versão, vigência, status (`draft`, `validating`, `published`, `superseded`, `archived`), origem, hash, autor/publicação. |
| `catalog_price_rows` | Preço por faixa e critérios: versão, faixa etária, valor, acomodação/coparticipação/segmentação e atributos. |
| `catalog_age_bands` | Faixa canônica: rótulo, mínima/máxima idade, ordem e status. |
| `catalog_coverages` / variantes | Vocabulário estruturado para cobertura, acomodação, coparticipação e segmentação. |
| `catalog_regions`, `catalog_municipalities`, `catalog_table_regions` | Elegibilidade por UF, município IBGE e região comercial. |
| `catalog_plan_networks` | Rede credenciada vinculada à versão quando aplicável. |
| `catalog_import_batches`, `catalog_import_rows` | Lote, staging, erro por linha, checksum e dados normalizados. |
| `catalog_publication_runs`, `catalog_audit_logs` | Aprovação/publicação/rollback e trilha imutável. |

`global_plan_id` identifica o produto; `catalog_table_version_id` identifica preço e condições. Ambos são obrigatórios em novas cotações e não podem ser tratados como o mesmo conceito.

### Configuração por tenant e unidade

Usar relações explícitas, não alvo polimórfico:

- `tenant_carrier_catalog_settings`: configuração feita exclusivamente pelo Super-admin para habilitar/ocultar/favoritar/ordenar operadora global em um tenant.
- `tenant_plan_catalog_settings`: configuração feita exclusivamente pelo Super-admin para habilitar/ocultar/favoritar/ordenar plano global em um tenant e guardar regras comerciais aprovadas.
- `branch_plan_catalog_restrictions`: configuração feita exclusivamente pelo Super-admin para restringir ou ordenar plano em uma unidade; nunca reabilita item oculto no nível superior.

Disponibilidade efetiva = item global publicado e vigente **E** habilitado pelo tenant **E** não restrito pela unidade. A política recomendada é allow-list: plano publicado não aparece automaticamente a todos os tenants.

### Extensão privada da corretora

O catálogo interno é um subdomínio separado, identificado como `source = tenant_private`. Ele usa `tenant_private_carriers`, `tenant_private_plans`, `tenant_private_price_tables` e `tenant_private_table_versions`, todos obrigatoriamente vinculados a um único `tenant_id` e sem FK/cópia reversa para o catálogo global. Mantém as mesmas garantias de versão, vigência, snapshot, auditoria e preços por faixa, mas é isolado de outros tenants.

O Diretor pode criar, editar, publicar e arquivar somente seus itens privados dentro da área `Catálogo interno` da corretora. O Super-admin continua como único administrador do catálogo oficial e visualiza/audita extensões privadas; ele pode promover uma cópia para o catálogo global por fluxo explícito de revisão, nunca por sincronização automática. Na cotação, o resolver une catálogo global permitido + extensão privada do tenant com um campo de proveniência, sem misturar identidades nem permitir acesso cruzado.

## Relacionamentos e snapshots

| Registro | Evolução |
|---|---|
| `leads.plan_id` | `global_plan_id` opcional: interesse declarado, sem fixar preço. |
| `quote_items` | `global_plan_id`, `catalog_table_version_id`, valor e snapshot obrigatório. |
| `quote_line_items` | mesmos IDs, idade e valor por beneficiário, snapshot. |
| `sales.carrier_plan_id` | `global_plan_id` e versão comercial da contratação, snapshot. |
| `commission_rules` | `global_carrier_id` e/ou `global_plan_id`, ainda isolados por tenant. |
| `document_requirements` | identidade global de operadora/plano; regra operacional permanece no tenant. |
| Extensão privada | usa IDs privados do tenant e o mesmo snapshot; nunca é visível nem reutilizável por outro tenant. |

Chaves legadas ficam apenas para compatibilidade. Proposta pública, PDF, detalhe de cotação, venda e relatórios devem ler primeiro o snapshot, nunca depender do catálogo vivo.

## Versionamento e vigência

1. Importação cria lote `draft`.
2. Normalização valida faixas, moeda, preço, região, duplicidade e sobreposição.
3. Super-admin revisa prévia e diff.
4. Publicação promove versão imutável com `effective_from` e `effective_to`.
5. Versão substituída vira `superseded`, nunca é apagada.

Invariantes: uma única versão publicada vigente por tabela e combinação comercial; publicação retroativa exige motivo/auditoria; arquivamento bloqueia novas cotações mas preserva histórico; reabrir cotação gera nova versão de cotação, não recalcula a antiga.

## Importação, publicação e auditoria

```text
CSV/XLSX/API futura → lote → staging normalizado → validação → prévia/diff
→ aprovação do Super-admin → publicação transacional → evento → invalidação de cache
```

Uma linha inválida não pode publicar parcialmente a tabela. O lote deve ser revisável, reprocessável e exportável. Auditoria registra ator, papel, correlação, origem, entidade, versão, alteração sanitizada e resultado para criar/editar/arquivar, importar, validar, publicar, reverter, habilitar e restringir.

## Consumo pelo cotador e propostas

```text
Tenant + unidade + perfil → disponibilidade → plano global → tabela vigente elegível
→ faixa etária/preço → quote item + IDs globais + snapshot
```

O serviço resolve tenant, unidade e papel pela sessão; nunca pelo cliente. O PDF e a proposta usam o snapshot. Comissão e documentos consultam a identidade global para localizar a regra do tenant, sem alterar dados oficiais.

## Permissões

| Ação | Super-admin | Diretor | Gestor | Corretor |
|---|---:|---:|---:|---:|
| Criar, editar, importar, publicar ou arquivar dado oficial | Sim | Não | Não | Não |
| Criar, editar, publicar ou arquivar item privado da própria corretora | Auditoria e promoção opcional | Sim | Não | Não |
| Habilitar, ocultar, favoritar e ordenar para tenant | Sim | Não | Não | Não |
| Restringir por unidade | Sim | Não | Não | Não |
| Consultar catálogo efetivo | Sim | Sim | Sim | Sim |
| Usar em cotação | Conforme RBAC operacional | Conforme RBAC operacional | Conforme RBAC operacional | Conforme RBAC operacional |

Toda configuração do catálogo oficial vive em `/super-admin/catalogo`, organizada em Catálogo Oficial, Disponibilidade por Tenant, Restrições por Unidade, Importações, Publicações e Auditoria. O Diretor possui apenas a área isolada `/catalogo/interno` para extensões privadas da própria corretora. O Super-admin controla a feature flag global `global_catalog`, uma flag separada `tenant_private_catalog` e um bloqueio de publicação. Com uma capacidade desativada, novas cotações recebem estado explícito de indisponibilidade e propostas históricas continuam legíveis.

## Performance

- Índices em `(carrier_id,status)`, `(plan_id,status)`, `(price_table_id,status,effective_from,effective_to)`, `(table_version_id,age_band_id,criteria_hash)`, `(tenant_id,global_plan_id)` e `(branch_id,global_plan_id)`.
- Paginação por cursor e busca indexada por nome/código; filtros server-side por operadora, categoria, região e vigência.
- Resolver de disponibilidade set-based, sem N+1.
- Cache por versão publicada + escopo tenant/unidade, invalidado por eventos; validação de vigência ainda ocorre antes de gravar a cotação.
- Publicação em transação: leitor vê versão anterior ou nova, nunca dados incompletos.

## Preparação para IA

O serviço público expõe atributos estruturados, vigência, elegibilidade e preço de versão publicada. IA consulta apenas esse serviço autorizado: não pode editar catálogo, ver item oculto nem calcular fora de versão vigente.

## Pipeline inteligente de atualização por documento

O pipeline pertence exclusivamente ao Super-admin e fica em `/super-admin/catalogo/importacoes`. Ele é uma ferramenta de **proposta de versão**, nunca de escrita autônoma. O mesmo pipeline pode tratar catálogo oficial ou, quando o Diretor enviar uma extensão privada para revisão, produzir uma proposta privada isolada — mas somente o Super-admin publica a versão resultante.

```text
Documento → extração → normalização → IA estruturada → diff → validação
→ revisão tipo Pull Request → aprovação explícita do Super-admin → publicação versionada
```

### Módulos e contratos

| Módulo | Responsabilidade | Proibição |
|---|---|---|
| `DocumentIngestion` | Recebe PDF pesquisável, texto ou Markdown; calcula hash, guarda origem e cria job. | Não interpreta nem publica. |
| `ContentExtractor` | Extrai texto/layout; registra se OCR é necessário. | Não infere preço diretamente. |
| `CatalogNormalizer` | Converte texto em contrato canônico de operadora, plano, tabela, faixa, valor, região e vigência. | Não usa texto bruto como comando. |
| `AiCatalogExtractor` | Devolve somente JSON validado, evidências por campo e confiança. | Não executa SQL, query nem mutation. |
| `CatalogDiffEngine` | Compara proposta normalizada com versão vigente; classifica criação, remoção, renomeação, alteração e promoção. | Não persiste no catálogo. |
| `CatalogValidationEngine` | Valida faixa, moeda, preço, vigência, sobreposição, região, identidade e confiança mínima. | Não aprova em nome do usuário. |
| `CatalogReviewWorkflow` | Mantém decisão por item: aprovar, rejeitar, editar ou ignorar. | Não publica sem aprovação final. |
| `CatalogVersionPublisher` | Cria nova versão transacional somente a partir dos itens aprovados. | Nunca sobrescreve ou exclui histórico. |

### Dados adicionais

- `catalog_source_documents`: metadados, hash SHA-256, tipo, armazenamento privado, extração, origem e retenção.
- `catalog_extraction_runs`: versão do parser/OCR/modelo, prompt versionado, estado, custo/latência e falhas sanitizadas.
- `catalog_change_sets`: proposta normalizada, alvo (global ou extensão privada), versão-base, estado e correlação.
- `catalog_change_items`: tipo de diff, antes/depois estruturado, evidência, confiança, decisão, revisor e motivo.
- `catalog_review_decisions`: trilha imutável das aprovações, rejeições, edições e publicação.

### Regras de confiança e revisão

- `>= 95%`: pode ser pré-selecionado para aprovação, mas ainda exige confirmação final do Super-admin.
- `80–94%`: revisão manual obrigatória por item.
- `< 80%`: bloqueado por padrão, precisa edição ou aprovação reforçada com motivo.
- Dados sem vigência, faixa ou valor inequívoco não podem gerar versão publicada.
- “Remoção” significa encerrar ou arquivar a versão no diff; nunca apagar entidade ou proposta histórica.

### Experiência do Super-admin

A tela contém: fila de importações, status do job, visualização segura do documento, resumo de confiança, filtros por operadora/tabela/risco, diff lado a lado, evidência que originou cada campo, ações por item e CTA único “Publicar versão aprovada”. O estado pós-publicação mostra versão, vigência, itens afetados, tenants/unidades impactados e link de auditoria. Diretor não vê essa superfície de publicação; ele apenas pode solicitar análise de um item privado para possível promoção global.

### Processamento e segurança

O pipeline é assíncrono, idempotente por `document_hash + alvo + versão-base`, reprocessável e preparado para lote. Arquivos ficam em storage privado, acesso e download são auditados e nenhum conteúdo de documento é enviado a modelo externo sem política/consentimento operacional definido. A publicação chama somente o serviço de domínio com identidade administrativa autenticada; o modelo recebe contrato de saída estrito e não possui credenciais de banco.

### Critérios de aceite do pipeline

Com uma nova tabela da Bradesco, o Super-admin consegue enviar o documento, identificar operadora e planos, detectar preços/faixas/promoções/vigência, revisar um diff completo, aprovar ou rejeitar cada item, publicar uma nova versão e consultar o documento, decisões e versão criada. Nenhum passo permite `PDF → IA → UPDATE` direto.

## Plano de migração sem indisponibilidade

### Fase 0 — decisão e inventário

Formalizar DEC-031/BR-030, congelar novo CRUD privado e mapear todas as referências diretas a tabelas legadas.

### Fase 1 — expansão aditiva

Criar schema global, disponibilidade, staging, auditoria, feature flag e domínio/repositórios, sem trocar leitores e sem remover FKs legadas.

### Fase 2 — backfill e curadoria

Extrair dados legados, normalizar ANS/nomes/atributos, agrupar duplicatas para revisão humana, criar versões iniciais com origem `legacy_migration`, criar allow-lists equivalentes e preencher IDs globais/snapshots sem apagar chaves antigas.

### Fase 3 — shadow read

Comparar resolver legado e global por tenant/unidade. Divergências de quantidade, preço, plano ou elegibilidade entram em relatório. Validar cotação, proposta antiga, PDF, venda, comissão, documento, conversa e cadastro manual.

### Fase 4 — corte gradual

Ativar por tenant com rollback temporário, sempre por ação do Super-admin. Trocar listas/cotador, depois documentos/comissões e por último administração. `/super-admin/catalogo` assume catálogo oficial, disponibilidade por tenant e restrições por unidade; `/catalogo/interno` entrega somente a extensão privada do Diretor. Proposta/PDF passam a usar snapshot antes do corte definitivo.

### Fase 5 — consolidação

Bloquear escrita tenant-owned, manter legado somente leitura até retenção/auditoria aprovadas e removê-lo apenas com backup verificável e relatório de zero dependências.

## Inventário de consultas a migrar

- `src/features/catalog/actions.ts` e `/catalogo`.
- `src/features/quotes/actions.ts`, modal de cotação, `/cotacoes`, `/leads/[id]`, `/conversas` e cadastro manual de leads.
- `/documentos` e `src/features/documents/actions.ts`.
- serviços/queries/exportações de comissão e financeiro.
- vendas, clientes, detalhe de cotação, rede, PDF e proposta pública.
- Todos os joins de `leads.plan_id`, `quote_items.plan_id`, `quote_line_items.plan_id` e `sales.carrier_plan_id`.

CI deve impedir novos imports diretos de `schema.carriers`, `schema.carrierPlans`, `schema.carrierPlanPrices` e `schema.carrierPlanNetworks` fora do domínio, migrações e adaptadores de compatibilidade.

## Riscos, roadmap e recomendações

| Risco | Mitigação |
|---|---|
| Mesmo nome, produto diferente | Código/ANS, curadoria humana e nenhuma fusão automática irreversível. |
| Preço novo altera proposta passada | Snapshot obrigatório e leitura histórica sem join vivo. |
| Plano aparece indevidamente | Allow-list por tenant e restrição descendente por unidade. |
| Sobreposição de vigência | Validador e constraint transacional. |
| Importação incorreta | Staging, preview, diff, aprovação e rollback por versão. |

Roadmap: (1) fundação e auditoria; (2) administração global e extensões privadas; (3) disponibilidade tenant/unidade; (4) resolver único e cotador; (5) snapshots em proposta/venda; (6) importação manual, staging e publicação; (7) pipeline inteligente com IA, diff e revisão; (8) backfill/shadow read/corte; (9) remoção controlada de escrita legada.

Recomendações: tratar publicação como operação crítica, priorizar identidade e versões antes de UX sofisticada, nunca usar `ON DELETE CASCADE` em dados consumidos historicamente e remover legado somente após equivalência por tenant e leitura histórica por snapshot comprovadas.
