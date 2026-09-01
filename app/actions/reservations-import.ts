"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { decodeCsvBuffer, parseSalonBoardCsv, type ParsedReservationRow } from "@/lib/import/salonboard";

export type ImportSummary =
  | {
      ok: true;
      totalDataRows: number;
      clientsCreated: number;
      clientsMatched: number;
      reservationsCreated: number;
      reservationsUpdated: number;
      skipped: { line: number; reason: string }[];
      dbErrors: { line: number; externalId: string; reason: string }[];
    }
  | { ok: false; formatError: string };

export async function importSalonBoardCsv(
  _prevState: ImportSummary | undefined,
  formData: FormData
): Promise<ImportSummary> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, formatError: "CSVファイルを選択してください。" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = decodeCsvBuffer(buffer);
  const parsed = parseSalonBoardCsv(text);
  if (!parsed.ok) return parsed;

  let clientsCreated = 0;
  let clientsMatched = 0;
  let reservationsCreated = 0;
  let reservationsUpdated = 0;
  const dbErrors: { line: number; externalId: string; reason: string }[] = [];

  for (const row of parsed.rows) {
    try {
      const client = await resolveClient(row);
      if (client.created) clientsCreated++;
      else clientsMatched++;

      const existing = await prisma.reservation.findUnique({ where: { externalId: row.externalId } });
      const data = {
        clientId: client.id,
        source: row.source,
        status: row.status,
        reservedAt: row.reservedAt,
        sourceStaffName: row.sourceStaffName,
        syncedAt: new Date(),
      };
      if (existing) {
        await prisma.reservation.update({ where: { id: existing.id }, data });
        reservationsUpdated++;
      } else {
        await prisma.reservation.create({ data: { ...data, externalId: row.externalId } });
        reservationsCreated++;
      }
    } catch (err) {
      dbErrors.push({
        line: row.line,
        externalId: row.externalId,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  revalidatePath("/clients");
  revalidatePath("/reminders");

  return {
    ok: true,
    totalDataRows: parsed.rows.length,
    clientsCreated,
    clientsMatched,
    reservationsCreated,
    reservationsUpdated,
    skipped: parsed.skipped,
    dbErrors,
  };
}

// お客様番号(サロンボードの顧客ID)を最優先の突合キーに、無ければ電話番号で照合する。
// どちらにも一致しなければ新規顧客として作成する(名前・カナ・電話・性別のみの最小限)。
async function resolveClient(row: ParsedReservationRow): Promise<{ id: string; created: boolean }> {
  if (row.customerNo) {
    const byNo = await prisma.client.findUnique({ where: { externalCustomerNo: row.customerNo } });
    if (byNo) return { id: byNo.id, created: false };
  }

  if (row.phone) {
    const byPhone = await prisma.client.findFirst({ where: { phone: row.phone } });
    if (byPhone) {
      if (row.customerNo && !byPhone.externalCustomerNo) {
        await prisma.client.update({
          where: { id: byPhone.id },
          data: { externalCustomerNo: row.customerNo },
        });
      }
      return { id: byPhone.id, created: false };
    }
  }

  const created = await prisma.client.create({
    data: {
      name: row.name ?? row.customerNo ?? "(不明)",
      kana: row.kana,
      phone: row.phone,
      gender: row.gender,
      externalCustomerNo: row.customerNo,
    },
  });
  return { id: created.id, created: true };
}
