import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";

import { getDatabase, schema } from "@/shared/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const body = await request.json().catch(() => ({}));
    const password: string | undefined = body.password;

    const db = getDatabase();
    const [row] = await db
      .select({
        id: schema.importedSpreadsheets.id,
        name: schema.importedSpreadsheets.name,
        description: schema.importedSpreadsheets.description,
        columns: schema.importedSpreadsheets.columns,
        data: schema.importedSpreadsheets.data,
        rowCount: schema.importedSpreadsheets.rowCount,
        publicPasswordHash: schema.importedSpreadsheets.publicPasswordHash,
      })
      .from(schema.importedSpreadsheets)
      .where(eq(schema.importedSpreadsheets.publicToken, token))
      .limit(1);

    if (!row) {
      return NextResponse.json(
        { error: "Visualização não encontrada ou link expirado." },
        { status: 404 },
      );
    }

    // Check password if set
    if (row.publicPasswordHash) {
      if (!password) {
        return NextResponse.json(
          { needsPassword: true, name: row.name, description: row.description },
          { status: 401 },
        );
      }
      const hash = createHash("sha256").update(password).digest("hex");
      if (hash !== row.publicPasswordHash) {
        return NextResponse.json(
          { error: "Senha incorreta." },
          { status: 403 },
        );
      }
    }

    return NextResponse.json({
      name: row.name,
      description: row.description,
      columns: row.columns,
      rows: row.data,
      rowCount: row.rowCount,
    });
  } catch (error) {
    console.error("[Public spreadsheet] error:", error);
    return NextResponse.json(
      { error: "Erro ao carregar visualização." },
      { status: 500 },
    );
  }
}
