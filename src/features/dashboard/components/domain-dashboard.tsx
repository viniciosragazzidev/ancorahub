import Link from "next/link";
import { ArrowUpRight } from "@/components/huge-icons";
import { Card, CardContent } from "@/components/ui/card";
import type { DomainDashboard } from "../service";
export function DomainDashboard({ data }: { data: DomainDashboard }) { return <><section className="space-y-1"><h1 className="text-2xl font-semibold tracking-tight">{data.title}</h1><p className="text-sm text-muted-foreground">{data.description}</p></section><section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{data.metrics.map((metric) => <Card key={metric.label} className="shadow-none"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{metric.label}</p><p className="mt-2 font-mono text-2xl font-semibold">{metric.value}</p></CardContent></Card>)}</section><Link href={data.actionHref} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Abrir operação <ArrowUpRight className="size-3.5" /></Link></>; }
