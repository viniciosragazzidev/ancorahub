import { RouteNotFound } from "@/components/route-not-found";

export default function DashboardNotFound() {
  return (
    <RouteNotFound
      title="Registro não encontrado"
      description="Esse registro não existe, foi removido ou não pertence ao escopo da sua equipe."
    />
  );
}
