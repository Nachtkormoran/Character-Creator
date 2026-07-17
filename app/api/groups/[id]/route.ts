import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

// Gruppe löschen. Zugeordnete Charaktere bleiben erhalten (groupId -> null,
// via onDelete: SetNull im Schema).
export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  try {
    await prisma.group.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Gruppe nicht gefunden." },
      { status: 404 },
    );
  }
}
