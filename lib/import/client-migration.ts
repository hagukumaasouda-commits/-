import Papa from "papaparse";
import { VisitInterval } from "@/app/generated/prisma/client";
import { VISIT_INTERVAL_BY_LABEL, RANK_VALUES } from "@/lib/tags";

// 顧客番号・ランク・データ移行用のCSV取り込み(docs/client-import-spec-v2.md)。
// サロンボードCSVと違い列名の重複が無いため、ヘッダー名でオブジェクト化して読む。

const EXPECTED_HEADERS = [
  "client_number",
  "name",
  "first_visit_date",
  "visit_count",
  "last_visit_date",
  "primary_staff",
  "rank",
  "required_visit_interval",
] as const;

export type ParsedClientImportRow = {
  line: number; // 元CSVの行番号(1始まり、ヘッダーを含む)
  clientNumber: string;
  name: string;
  firstVisitDate: Date | null;
  visitCount: number | null;
  lastVisitDate: Date | null;
  primaryStaffName: string | null;
  rank: string | null;
  requiredVisitInterval: VisitInterval | null;
  warnings: string[];
};

export type RowSkip = { line: number; reason: string };

export type ParseResult =
  | { ok: true; rows: ParsedClientImportRow[]; skipped: RowSkip[] }
  | { ok: false; formatError: string };

// "2026-04-07" / "2026/04/07" / "20260407" -> Date
function parseFlexibleDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  let year: number, month: number, day: number;
  if (/^\d{8}$/.test(s)) {
    year = Number(s.slice(0, 4));
    month = Number(s.slice(4, 6));
    day = Number(s.slice(6, 8));
  } else {
    const m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (!m) return null;
    year = Number(m[1]);
    month = Number(m[2]);
    day = Number(m[3]);
  }
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseClientImportCsv(text: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (parsed.data.length === 0) {
    return { ok: false, formatError: "データ行が見つかりません。CSVファイルの中身を確認してください。" };
  }

  const actualHeaders = new Set(parsed.meta.fields ?? []);
  const missingHeaders = EXPECTED_HEADERS.filter((h) => !actualHeaders.has(h));
  if (missingHeaders.length > 0) {
    return {
      ok: false,
      formatError: `想定した列が見つかりません: ${missingHeaders.join(", ")}。ヘッダー行を確認してください。`,
    };
  }

  const rows: ParsedClientImportRow[] = [];
  const skipped: RowSkip[] = [];

  parsed.data.forEach((raw, i) => {
    const line = i + 2; // ヘッダー行(1)の次から
    const clientNumber = (raw.client_number ?? "").trim();
    const name = (raw.name ?? "").trim();
    if (!clientNumber || !name) {
      skipped.push({ line, reason: "client_number または name が空です" });
      return;
    }

    const warnings: string[] = [];

    const visitCountRaw = (raw.visit_count ?? "").trim();
    const visitCount = visitCountRaw ? Number(visitCountRaw) : null;
    if (visitCountRaw && (!Number.isInteger(visitCount) || (visitCount as number) <= 0)) {
      warnings.push(`visit_countの値が不正です: "${visitCountRaw}"`);
    }

    const firstVisitDateRaw = (raw.first_visit_date ?? "").trim();
    const firstVisitDate = parseFlexibleDate(firstVisitDateRaw);
    if (firstVisitDateRaw && !firstVisitDate) {
      warnings.push(`first_visit_dateの形式が不正です: "${firstVisitDateRaw}"`);
    }

    const lastVisitDateRaw = (raw.last_visit_date ?? "").trim();
    const lastVisitDate = parseFlexibleDate(lastVisitDateRaw);
    if (lastVisitDateRaw && !lastVisitDate) {
      warnings.push(`last_visit_dateの形式が不正です: "${lastVisitDateRaw}"`);
    }

    const rankRaw = (raw.rank ?? "").trim();
    const rank = (RANK_VALUES as readonly string[]).includes(rankRaw) ? rankRaw : null;
    if (rankRaw && !rank) {
      warnings.push(`rankの値が不正です(${RANK_VALUES.join("/")}のいずれかを想定): "${rankRaw}"`);
    }

    const intervalRaw = (raw.required_visit_interval ?? "").trim();
    const requiredVisitInterval = intervalRaw ? (VISIT_INTERVAL_BY_LABEL[intervalRaw] ?? null) : null;
    if (intervalRaw && !requiredVisitInterval) {
      warnings.push(`required_visit_intervalの値が不正です: "${intervalRaw}"`);
    }

    rows.push({
      line,
      clientNumber,
      name,
      firstVisitDate,
      visitCount: Number.isInteger(visitCount) && (visitCount as number) > 0 ? visitCount : null,
      lastVisitDate,
      primaryStaffName: (raw.primary_staff ?? "").trim() || null,
      rank,
      requiredVisitInterval,
      warnings,
    });
  });

  return { ok: true, rows, skipped };
}
