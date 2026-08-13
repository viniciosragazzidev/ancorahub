import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { sendTenantTemplateTestMessage } from "@/features/communication-channels/template-sync-service";

const testSchema = z.object({
  destinationPhone: z.string().min(10).max(15),
  variables: z.array(z.string()).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getRequiredTenantContext();
    if (context.role === "broker") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validated = testSchema.parse(body);

    const result = await sendTenantTemplateTestMessage(
      context.tenantId,
      context.userId,
      id,
      validated.destinationPhone,
      validated.variables,
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao enviar mensagem de teste.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
