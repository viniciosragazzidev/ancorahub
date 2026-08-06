"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MemberStatusBadge, RoleBadge } from "@/components/status-badges";
import { AvailabilityToggle } from "@/app/(dashboard)/corretor/resumo/_components/availability-toggle";
import { formatDate } from "@/features/quotes/utils";
import type { PerfilData } from "./perfil-tabs";

const roleLabel: Record<string, string> = {
  director: "Diretor",
  manager: "Gestor",
  broker: "Corretor",
};

function ProfileAvatar({ initialImage, name }: { initialImage: string | null; name: string }) {
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Avatar
      size="lg"
      className="size-20 rounded-2xl border-4 border-card bg-card shadow-2xs sm:size-24"
    >
      {initialImage ? <AvatarImage src={initialImage} alt={name} className="rounded-xl" /> : null}
      <AvatarFallback className="rounded-xl bg-primary/10 text-xl font-semibold text-primary">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

export function ProfileHeader({ data }: { data: PerfilData }) {
  const user = data.user;
  const membership = data.membership;
  const broker = data.brokerProfile;
  if (!user || !membership) return null;

  const roleName = membership.customRoleName ?? roleLabel[membership.role] ?? membership.role;
  const displayName = broker?.professionalName ?? user.name;
  const isBroker = membership.role === "broker";

  return (
    <Card variant="overview" className="overflow-visible bg-card/80 shadow-2xs">
      <div className="h-20 border-b border-border/50 bg-muted/60 sm:h-24" aria-hidden="true" />
      <CardContent className="relative px-5 pb-5 pt-12 sm:px-6 sm:pt-5">
        <div className="absolute -top-10 left-5 sm:-top-12 sm:left-6">
          <ProfileAvatar initialImage={user.image} name={displayName} />
        </div>

        <div className="flex flex-col gap-4 sm:pl-28 sm:pr-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-semibold tracking-tight text-foreground">
                  {displayName}
                </h2>
                <MemberStatusBadge
                  status={membership.status === "active" ? "active" : "inactive"}
                />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <RoleBadge role={membership.role} />
                <span>{roleName}</span>
                <span className="text-border">•</span>
                <span>{membership.branchName ?? "Geral da empresa"}</span>
              </div>
              <p className="mt-2 truncate text-sm text-muted-foreground">{user.email}</p>
            </div>

            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              {isBroker ? (
                <AvailabilityToggle
                  initialStatus={
                    membership.availabilityStatus as "available" | "paused" | "offline"
                  }
                />
              ) : null}
              <Badge variant="outline" className="text-xs font-medium">
                No sistema desde{" "}
                {formatDate(user.createdAt, { day: "numeric", month: "short", year: "numeric" })}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 border-t border-border/60 pt-4 text-xs">
            {broker?.internalCode ? (
              <div>
                <p className="text-muted-foreground">Código interno</p>
                <p className="mt-0.5 font-mono font-medium text-foreground">
                  {broker.internalCode}
                </p>
              </div>
            ) : null}
            <div>
              <p className="text-muted-foreground">E-mail verificado</p>
              <p className="mt-0.5 font-medium text-foreground">
                {user.emailVerified ? "Sim" : "Não"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Autenticação em duas etapas</p>
              <p className="mt-0.5 font-medium text-foreground">
                {user.twoFactorEnabled ? "Ativada" : "Não configurada"}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
