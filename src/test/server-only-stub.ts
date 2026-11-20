// "server-only" não está instalado no projeto (o Next resolve sozinho no build). Nos testes, o import aponta para
// este módulo vazio, para que um arquivo novo com `import "server-only"` não quebre a suíte (20/11).
export {};
