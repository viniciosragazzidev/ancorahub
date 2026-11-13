"use client";
import { AnalyticsError } from "@/features/erp/components/analytics-views";
export default function Error({ reset }: { reset: () => void }) { return <AnalyticsError title="Crescimento indisponível" reset={reset} clearHref="/relatorios/crescimento" />; }
