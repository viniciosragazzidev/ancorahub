import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ShortLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) redirect("/minha-fila");
  redirect(`/leads/${id}`);
}
