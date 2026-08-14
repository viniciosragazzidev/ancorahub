"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type BranchOption = { id: string; name: string };

export function BranchSelect({
  branches,
  value,
  placeholder = "Todas as Unidades",
}: {
  branches: BranchOption[];
  value?: string;
  placeholder?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  if (!branches || branches.length <= 1) return null;

  function handleSelect(branchId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!branchId || branchId === "all") {
      params.delete("branch");
    } else {
      params.set("branch", branchId);
    }
    params.delete("page");
    if (pathname) router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <Select value={value || "all"} onValueChange={(val) => handleSelect(val ?? "all")}>
      <SelectTrigger className="w-44 text-xs bg-card" aria-label="Filtrar por unidade">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {branches.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
