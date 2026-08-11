import Image from "next/image";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export function RouteNotFound({
  title = "Página não encontrada",
  description = "A página que você procura não existe, foi movida ou o endereço está incorreto.",
  imageSrc = "/404.png",
  backUrl = "/dashboard",
  backText = "Voltar para o Dashboard",
}: {
  title?: string;
  description?: string;
  imageSrc?: string;
  backUrl?: string;
  backText?: string;
}) {
  return (
    <main
      className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center px-4 py-12 text-center"
      aria-labelledby="not-found-title"
    >
      <div className="relative mb-6 flex items-center justify-center">
        <Image
          src={imageSrc}
          alt="404 - Página não encontrada"
          width={380}
          height={320}
          priority
          className="h-auto max-w-[280px] sm:max-w-[360px] object-contain drop-shadow-md transition-transform duration-300 hover:scale-[1.02]"
        />
      </div>

      <div className="space-y-2.5 max-w-md">
        <h1 id="not-found-title" className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base leading-relaxed">
          {description}
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={backUrl}
          className={cn(
            buttonVariants({ size: "lg" }),
            "gap-2 px-6 shadow-sm hover:shadow transition-all"
          )}
        >
          <LayoutDashboard className="size-4" />
          <span>{backText}</span>
        </Link>
      </div>
    </main>
  );
}
