// Arquivos .css importados como texto (loader "text" do esbuild), injetados no shadow root.
declare module "*.css" {
  const texto: string;
  export default texto;
}
