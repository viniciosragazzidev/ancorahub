import { randomUUID } from "node:crypto";
import { and, asc, count, eq, gt, isNull, notInArray, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { canExportBrokerLeads } from "@/features/team/broker-lead-export-access";
import { isTeamMemberProfileEnabled } from "@/features/team/member-profile";
import {
  BROKER_LEAD_EXPORT_COLUMNS,
  buildBrokerLeadExportRow,
  buildBrokerLeadsFilename,
  buildBrokerLeadExportScope,
  canExportBrokerMember,
} from "@/features/team/broker-lead-export";
import { encodeCsvHeader, encodeCsvRow } from "@/features/reports/csv-export";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { AuthenticationError, AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BATCH_SIZE = 500;

type RouteContext = { params: Promise<{ brokerId: string }> };

function buildLeadFilter(
  scope: ReturnType<typeof buildBrokerLeadExportScope>,
  cursor?: { createdAt: Date; id: string },
) {
  return and(
    eq(schema.leads.tenantId, scope.tenantId),
    eq(schema.leads.corretorId, scope.currentOwnerId),
    isNull(schema.leads.deletedAt),
    scope.branchId ? eq(schema.leads.branchId, scope.branchId) : undefined,
    scope.excludedStatuses.length
      ? notInArray(schema.leads.status, [...scope.excludedStatuses])
      : undefined,
    cursor
      ? or(
          gt(schema.leads.createdAt, cursor.createdAt),
          and(eq(schema.leads.createdAt, cursor.createdAt), gt(schema.leads.id, cursor.id)),
        )
      : undefined,
  );
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director" && context.role !== "manager") {
      return NextResponse.json(
        { error: "Sem permissão para exportar leads deste corretor." },
        { status: 403 },
      );
    }
    if (!(await isTeamMemberProfileEnabled())) {
      return NextResponse.json(
        { error: "A exportação de leads está indisponível." },
        { status: 404 },
      );
    }

    if (!(await canExportBrokerLeads(context))) {
      return NextResponse.json({ error: "Seu cargo não permite exportar leads." }, { status: 403 });
    }

    const { brokerId } = await params;
    if (!UUID.test(brokerId))
      return NextResponse.json({ error: "Corretor inválido." }, { status: 400 });

    const db = getDatabase();
    const [member] = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        role: schema.tenantMemberships.role,
        branchId: schema.tenantMemberships.branchId,
      })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .where(
        and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.user.id, brokerId)),
      )
      .limit(1);

    if (
      !member ||
      !canExportBrokerMember({
        viewerRole: context.role,
        viewerBranchId: context.branchId,
        memberRole: member.role,
        memberBranchId: member.branchId,
      })
    ) {
      return NextResponse.json(
        { error: "Corretor não encontrado no seu escopo." },
        { status: 404 },
      );
    }
    if (context.role === "manager" && !context.branchId) {
      return NextResponse.json(
        { error: "Seu usuário não está vinculado a uma unidade." },
        { status: 403 },
      );
    }

    const searchParams = new URL(request.url).searchParams;
    const rawIncludeClosed = searchParams.get("includeClosed");
    if (rawIncludeClosed !== null && rawIncludeClosed !== "true" && rawIncludeClosed !== "false") {
      return NextResponse.json(
        { error: "O filtro de convertidos e perdidos é inválido." },
        { status: 400 },
      );
    }
    const includeClosed = rawIncludeClosed !== "false";
    const scope = buildBrokerLeadExportScope({
      tenantId: context.tenantId,
      brokerId: member.id,
      viewerRole: context.role,
      viewerBranchId: context.branchId,
      includeClosed,
    });
    const filter = buildLeadFilter(scope);
    const [countResult] = await db.select({ total: count() }).from(schema.leads).where(filter);
    const total = Number(countResult?.total ?? 0);
    const generatedAt = new Date();
    const filename = buildBrokerLeadsFilename(member.name, generatedAt);

    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "report",
      entidadeId: "broker_leads",
      acao: `report.generated:broker-leads:${member.id}:${total}:csv`,
      metadata: {
        tenantId: context.tenantId,
        brokerId: member.id,
        branchId: scope.branchId,
        currentOwnerOnly: true,
        includeConvertedAndLost: includeClosed,
        count: total,
        format: "csv",
        generatedAt: generatedAt.toISOString(),
      },
    });

    // 05/11: streaming (ReadableStream) broke behind the production proxy (ERR_QUIC_PROTOCOL_ERROR).
    // A broker's portfolio is small (hundreds of rows), so build the whole CSV and send it with Content-Length.
    const lines: string[] = [encodeCsvHeader(BROKER_LEAD_EXPORT_COLUMNS)];
    const baseUrl = publicBaseUrl(request);
    let cursor: { createdAt: Date; id: string } | undefined;
    for (;;) {
      const rows = await db
        .select({
          id: schema.leads.id,
          nome: schema.leads.nome,
          telefone: schema.leads.telefone,
          email: schema.leads.email,
          tipo: schema.leads.tipo,
          origem: schema.leads.origem,
          sourceChannel: schema.leads.sourceChannel,
          sourceCampaign: schema.leads.sourceCampaign,
          queueName: schema.leadQueues.name,
          branchName: schema.branches.name,
          status: schema.leads.status,
          qualificationStatus: schema.leads.qualificationStatus,
          monthlyValue: schema.leads.monthlyValue,
          livesCount: schema.leads.livesCount,
          createdAt: schema.leads.createdAt,
          assignedAt: schema.leads.assignedAt,
          firstContactAt: schema.leads.firstContactAt,
          motivoPerda: schema.leads.motivoPerda,
          latestInteractionAt: sql<Date | null>`(
              select max(${schema.leadInteractions.createdAt})
              from ${schema.leadInteractions}
              where ${schema.leadInteractions.leadId} = ${schema.leads.id}
            )`,
          qualificationSummary: sql<string | null>`(
              select ${schema.aiConversations.qualificationSummary}
              from ${schema.aiConversations}
              where ${schema.aiConversations.tenantId} = ${scope.tenantId}
                and ${schema.aiConversations.leadId} = ${schema.leads.id}
              order by ${schema.aiConversations.lastActivityAt} desc, ${schema.aiConversations.createdAt} desc
              limit 1
            )`,
        })
        .from(schema.leads)
        .leftJoin(
          schema.leadQueues,
          and(
            eq(schema.leadQueues.id, schema.leads.queueId),
            eq(schema.leadQueues.tenantId, scope.tenantId),
          ),
        )
        .leftJoin(
          schema.branches,
          and(
            eq(schema.branches.id, schema.leads.branchId),
            eq(schema.branches.tenantId, scope.tenantId),
          ),
        )
        .where(buildLeadFilter(scope, cursor))
        .orderBy(asc(schema.leads.createdAt), asc(schema.leads.id))
        .limit(BATCH_SIZE);

      for (const lead of rows)
        lines.push(
          encodeCsvRow(buildBrokerLeadExportRow(lead, baseUrl), BROKER_LEAD_EXPORT_COLUMNS),
        );
      if (rows.length < BATCH_SIZE) break;
      const last = rows.at(-1)!;
      cursor = { createdAt: last.createdAt, id: last.id };
    }
    const body = new TextEncoder().encode(`﻿${lines.join("\r\n")}\r\n`);

    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "no-store",
        "X-Export-Rows": String(total),
        "X-Export-Filename": filename,
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError)
      return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
    if (error instanceof AuthorizationError)
      return NextResponse.json(
        { error: "Sem permissão para exportar leads deste corretor." },
        { status: 403 },
      );
    return NextResponse.json({ error: "Não foi possível exportar os leads." }, { status: 500 });
  }
}

function publicBaseUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.BETTER_AUTH_URL?.trim();
  if (configured) return new URL(configured).origin;
  if (process.env.NODE_ENV === "production") return "https://crm.ancorasaude.cloud";
  return new URL(request.url).origin;
}
