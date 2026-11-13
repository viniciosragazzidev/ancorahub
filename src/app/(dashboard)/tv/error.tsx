"use client";
import { AnalyticsError } from "@/features/erp/components/analytics-views";
export default function Error({ reset }: { reset: () => void }) { return <AnalyticsError title="Modo TV indisponível" reset={reset} clearHref="/tv" />; }
