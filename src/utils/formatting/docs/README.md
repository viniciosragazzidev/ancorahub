# Formatting

Máscaras, normalização e parsing de dados de entrada. As funções devem ser
puras e não podem persistir dados, emitir eventos ou aplicar regras de negócio.

Durante a migração, os módulos legados continuam sendo a fonte de implementação
para evitar quebra de imports. Eles serão movidos integralmente após a validação
da build.
