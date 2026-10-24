import { redirect } from "next/navigation";

// A rota segue existindo só para o link antigo: o redirect é incondicional.
export default function RoadmapPage() {
  redirect("/dashboard");
}
