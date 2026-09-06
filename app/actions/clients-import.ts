"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { decodeCsvBuffer } from "@/lib/import/salonboard";
import { parseClientImportCsv, type ParsedClientImportRow } from "@/lib/import/client-migration";

export type ClientImportSummary =
  | {
      ok: true;
      totalDataRows: number;
      clientsCreated: number;
      clientsMatched: number;
      ranksRecorded: number;
      seedVisitsCreated: number;
      skipped: { line: number; reason: string }[];
      warnings: { line: number; clientNumber: string; reason: string }[];
      dbErrors: { line: number; clientNumber: string; reason: string }[];
    }
  | { ok: false; formatError: string };

export async function importClientMigrationCsv(
  _prevState: ClientImportSummary | undefined,
  formData: FormData
): Promise<ClientImportSummary> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, formatError: "CSVファイルを選択してください。" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = decodeCsvBuffer(buffer);
  const parsed = parseClientImportCsv(text);
  if (!parsed.ok) return parsed;

  let clientsCreated = 0;
  let clientsMatched = 0;
  let ranksRecorded = 0;
  let seedVisitsCreated = 0;
  const warnings: { line: number; clientNumber: string; reason: string }[] = [];
  const dbErrors: { line: number; clientNumber: string; reason: string }[] = [];

  for (const row of parsed.rows) {
    try {
      const rowWarnings = [...row.warnings];

      const clientId = await upsertClient(row, rowWarnings);
      if (!clientId.created) clientsMatched++;
      else clientsCreated++;

      if (row.rank) {
        await recordRankSnapshot(clientId.id, row.rank);
        ranksRecorded++;
      }

      if (await createSeedVisitIfEligible(clientId.id, clientId.primaryStaffId, row, rowWarnings)) {
        seedVisitsCreated++;
      }

      for (const reason of rowWarnings) warnings.push({ line: row.line, clientNumber: row.clientNumber, reason });
    } catch (err) {
      dbErrors.push({
        line: row.line,
        clientNumber: row.clientNumber,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  revalidatePath("/clients");

  return {
    ok: true,
    totalDataRows: parsed.rows.length,
    clientsCreated,
    clientsMatched,
    ranksRecorded,
    seedVisitsCreated,
    skipped: parsed.skipped,
    warnings,
    dbErrors,
  };
}

async function upsertClient(
  row: ParsedClientImportRow,
  rowWarnings: string[]
): Promise<{ id: string; created: boolean; primaryStaffId: string | null }> {
  let primaryStaffId: string | null = null;
  if (row.primaryStaffName) {
    const staff = await prisma.staff.findFirst({ where: { name: row.primaryStaffName } });
    if (staff) primaryStaffId = staff.id;
    else rowWarnings.push(`primary_staffが見つかりません: "${row.primaryStaffName}"`);
  }

  const clientData = {
    name: row.name,
    externalCustomerNo: row.clientNumber,
    ...(row.firstVisitDate ? { firstVisitDate: row.firstVisitDate } : {}),
    ...(primaryStaffId ? { primaryStaffId } : {}),
  };

  const existing = await prisma.client.findUnique({ where: { externalCustomerNo: row.clientNumber } });
  const client = existing
    ? await prisma.client.update({ where: { id: existing.id }, data: clientData })
    : await prisma.client.create({ data: clientData });

  if (primaryStaffId) {
    await prisma.clientStaff.upsert({
      where: { clientId_staffId: { clientId: client.id, staffId: primaryStaffId } },
      update: {},
      create: { clientId: client.id, staffId: primaryStaffId },
    });
  }

  return { id: client.id, created: !existing, primaryStaffId };
}

// 今日の日付でランクのスナップショットを1件記録する(同日に既存があれば上書き)。
async function recordRankSnapshot(clientId: string, rank: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const existing = await prisma.clientStatusSnapshot.findFirst({ where: { clientId, snapshotDate: today } });
  if (existing) {
    await prisma.clientStatusSnapshot.update({ where: { id: existing.id }, data: { rank } });
  } else {
    await prisma.clientStatusSnapshot.create({ data: { clientId, snapshotDate: today, rank } });
  }
}

// visit_count/last_visit_date/required_visit_interval を、来院履歴を1件も持たない顧客に
// 限って「まとめ来院」1件として反映する(docs/client-import-spec-v2.md 2節)。
async function createSeedVisitIfEligible(
  clientId: string,
  primaryStaffId: string | null,
  row: ParsedClientImportRow,
  rowWarnings: string[]
): Promise<boolean> {
  if (!row.visitCount || !row.lastVisitDate) return false;

  if (!primaryStaffId) {
    rowWarnings.push("primary_staffが未確定のため、来院回数の初期化をスキップしました");
    return false;
  }

  const existingVisitCount = await prisma.visit.count({ where: { clientId } });
  if (existingVisitCount > 0) {
    rowWarnings.push("既に来院記録があるため、来院回数の初期化をスキップしました");
    return false;
  }

  const visit = await prisma.visit.create({
    data: { clientId, staffId: primaryStaffId, visitDate: row.lastVisitDate, visitNo: row.visitCount },
  });
  await prisma.chartRecord.create({
    data: {
      visitId: visit.id,
      chiefComplaintTags: [],
      bodyPartTags: [],
      requiredVisitInterval: row.requiredVisitInterval,
    },
  });
  return true;
}
