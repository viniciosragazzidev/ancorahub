import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getErpNavigation } from "@/features/erp/navigation";
export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const links = (await getErpNavigation()).filter((link) => link.href.startsWith("/financeiro"));
  return <><nav aria-label="Seções do financeiro" className="flex flex-wrap gap-2 px-4 py-2">{links.map((link) => <Button key={link.href} variant="ghost" render={<Link href={link.href} />}>{link.label}</Button>)}</nav>{children}</>;
}
