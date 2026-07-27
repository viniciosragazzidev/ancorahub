# Workspace documental de lead, cliente e dependentes

Documentos são opcionais. O checklist orienta o corretor, mas não bloqueia atendimento, distribuição ou conversão.

## Entrega atual

- Upload com categoria, descrição, MIME, tamanho, checksum e versão.
- Vínculo opcional ao cliente convertido e ao beneficiário.
- Exclusão lógica e auditoria de upload, revisão e remoção.
- Detalhe do lead sempre acessível, inclusive após distribuição.
- Atalho contextual na lateral de Conversas para anexar documentos.
- Interface separa documentos por titular e dependentes, inclusive para documentos avulsos.
- Armazenamento de produção em bucket privado; o disco efêmero do deploy não é usado.

## Próxima camada de produção

1. Configurar o bucket privado e a chave de servidor em cada ambiente.
2. Gerar URLs assinadas de curta duração.
3. Executar verificação antivírus antes da publicação.
4. Implementar upload múltiplo com retry e versionamento visual.
5. Materializar biblioteca documental do cliente sem duplicar arquivos.

## Regras de acesso

Corretores acessam seus leads; gestores acessam sua unidade; diretores acessam o tenant. Visualizações, downloads, revisões e exclusões devem gerar auditoria.
