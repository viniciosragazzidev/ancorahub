import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function RouteLoading() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-[1440px] flex-col gap-5 p-4 lg:p-6" aria-busy="true" aria-label="Carregando conteúdo">
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index}>
            <CardHeader><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" /></CardHeader>
            <CardContent className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-3 w-3/4" /></CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}
