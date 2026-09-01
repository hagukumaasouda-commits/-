import Papa from "papaparse";
import iconv from "iconv-lite";
import { ReservationSource, ReservationStatus } from "@/app/generated/prisma/client";

// サロンボード(ホットペッパービューティー予約管理)の予約CSVエクスポート用パーサ。
//
// 重要な罠: このCSVは列名が重複する(「開始時間」「終了時間」が来店予定と第一希望で2回、
// 「性別」「電話番号」が予約時入力と顧客マスタで複数回登場する)。ヘッダー名でオブジェクト化
// すると後の列で上書きされ、来店日時を取り違える。そのため配列のまま「列位置」で読む。
//
// 実際に共有いただいたエクスポートで検証した列位置(0始まり):
const COL = {
  STATUS: 0, // ステータス(受付待ち/会計済み/サロンキャンセル 等)
  EXTERNAL_ID: 1, // 予約番号(例: YH09102834)。再取り込み時の重複防止キー
  STAFF_NAME: 3, // スタッフ名
  VISIT_DATE: 6, // 来店日(YYYYMMDD) ← 来店予定(第一希望ではない方)
  START_TIME: 7, // 開始時間(H*MM、コロンなし) ← 来店予定の方
  SOURCE: 14, // 予約経路
  FURIGANA_BOOKING: 23, // フリガナ(予約時入力)
  NAME_BOOKING: 24, // お名前(予約時入力)
  PHONE_BOOKING: 25, // 電話番号(予約時入力)
  GENDER_BOOKING: 26, // 性別(予約時入力)
  KANA_MASTER: 27, // 氏名(カナ)(顧客マスタ)
  KANJI_MASTER: 28, // 氏名(漢字)(顧客マスタ)
  PHONE_MASTER: 29, // 電話番号(顧客マスタ)
  CUSTOMER_NO: 30, // お客様番号 ← 顧客管理シートの「ID」列と同一体系。突合キー
} as const;

// このインデックスに、想定した列名が本当に来ているかを確認する。エクスポート形式が
// 変わっていた場合、位置ズレを起こしたまま静かに誤取り込みするより先に止める。
const EXPECTED_HEADERS: Partial<Record<number, string>> = {
  [COL.STATUS]: "ステータス",
  [COL.EXTERNAL_ID]: "予約番号",
  [COL.VISIT_DATE]: "来店日",
  [COL.START_TIME]: "開始時間",
  [COL.SOURCE]: "予約経路",
  [COL.CUSTOMER_NO]: "お客様番号",
};

export type ParsedReservationRow = {
  line: number; // 元CSVの行番号(1始まり、ヘッダーを含む)
  externalId: string;
  status: ReservationStatus;
  source: ReservationSource;
  reservedAt: Date;
  sourceStaffName: string | null;
  customerNo: string | null;
  name: string | null;
  kana: string | null;
  phone: string | null;
  gender: "男" | "女" | null;
};

export type RowSkip = { line: number; reason: string };

export type ParseResult =
  | { ok: true; rows: ParsedReservationRow[]; skipped: RowSkip[] }
  | { ok: false; formatError: string };

export function decodeCsvBuffer(buffer: Buffer): string {
  // BOM付きUTF-8はそのまま、BOM無しはUTF-8として妥当か検証し、
  // 不正(Shift_JISエクスポートの典型)ならShift_JISとして読み直す。
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString("utf-8");
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return iconv.decode(buffer, "Shift_JIS");
  }
}

function mapStatus(raw: string): ReservationStatus {
  if (raw.includes("キャンセル")) return ReservationStatus.CANCELLED;
  if (raw.includes("会計済み") || raw.includes("来店済み")) return ReservationStatus.COMPLETED;
  return ReservationStatus.CONFIRMED;
}

function mapSource(raw: string): ReservationSource {
  if (raw.includes("HotPepper") || raw.includes("ネット")) return ReservationSource.HOTPEPPER;
  if (raw.includes("LINE")) return ReservationSource.LINE;
  if (raw.includes("電話")) return ReservationSource.PHONE;
  return ReservationSource.MANUAL;
}

function mapGender(raw: string): "男" | "女" | null {
  if (raw.includes("女")) return "女";
  if (raw.includes("男")) return "男";
  return null;
}

// "20260901" -> {year:2026, month:9, day:1} / "930" or "1825" -> {hour, minute}
function parseVisitDateTime(dateRaw: string, timeRaw: string): Date | null {
  const d = dateRaw.trim();
  const t = timeRaw.trim().padStart(4, "0");
  if (!/^\d{8}$/.test(d) || !/^\d{4}$/.test(t)) return null;
  const year = Number(d.slice(0, 4));
  const month = Number(d.slice(4, 6));
  const day = Number(d.slice(6, 8));
  const hour = Number(t.slice(0, 2));
  const minute = Number(t.slice(2, 4));
  const date = new Date(year, month - 1, day, hour, minute);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function cell(row: string[], index: number): string {
  return (row[index] ?? "").trim();
}

export function parseSalonBoardCsv(text: string): ParseResult {
  const parsed = Papa.parse<string[]>(text, { delimiter: "", skipEmptyLines: true });
  const table = parsed.data;
  if (table.length < 2) {
    return { ok: false, formatError: "データ行が見つかりません。CSVファイルの中身を確認してください。" };
  }

  const headerRow = table[0];
  for (const [indexStr, expected] of Object.entries(EXPECTED_HEADERS)) {
    const index = Number(indexStr);
    if ((headerRow[index] ?? "").trim() !== expected) {
      return {
        ok: false,
        formatError:
          `想定した列(${index + 1}列目は「${expected}」のはず)と一致しませんでした。` +
          `サロンボードのエクスポート形式が変わっている可能性があるため、取り込みを中止しました。` +
          `お手数ですが最新のサンプルを共有してください。`,
      };
    }
  }

  const rows: ParsedReservationRow[] = [];
  const skipped: RowSkip[] = [];

  for (let i = 1; i < table.length; i++) {
    const row = table[i];
    const line = i + 1;
    const externalId = cell(row, COL.EXTERNAL_ID);
    if (!externalId) {
      skipped.push({ line, reason: "予約番号が空です" });
      continue;
    }

    const reservedAt = parseVisitDateTime(cell(row, COL.VISIT_DATE), cell(row, COL.START_TIME));
    if (!reservedAt) {
      skipped.push({ line, reason: `来店日/開始時間を解釈できません(${cell(row, COL.EXTERNAL_ID)})` });
      continue;
    }

    const customerNo = cell(row, COL.CUSTOMER_NO) || null;
    const kana = cell(row, COL.KANA_MASTER) || cell(row, COL.FURIGANA_BOOKING) || null;
    const name = cell(row, COL.KANJI_MASTER) || cell(row, COL.NAME_BOOKING) || kana || null;
    if (!name && !customerNo) {
      skipped.push({ line, reason: "氏名・お客様番号のいずれも取得できません" });
      continue;
    }

    rows.push({
      line,
      externalId,
      status: mapStatus(cell(row, COL.STATUS)),
      source: mapSource(cell(row, COL.SOURCE)),
      reservedAt,
      sourceStaffName: cell(row, COL.STAFF_NAME) || null,
      customerNo,
      name,
      kana,
      phone: cell(row, COL.PHONE_MASTER) || cell(row, COL.PHONE_BOOKING) || null,
      gender: mapGender(cell(row, COL.GENDER_BOOKING)),
    });
  }

  return { ok: true, rows, skipped };
}
