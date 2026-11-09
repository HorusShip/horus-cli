/**
 * Output. `--json` prints the API's JSON verbatim (pretty, stable keys as
 * returned); otherwise lists render as tables and objects as key/value lines.
 * Color is opt-in per call (never a module global) so this stays pure and
 * the existing plain-text assertions keep working untouched.
 */
import { NO_COLORS, paintSigned, paintStatus, type Colors } from "./colors.js";

const PREFERRED = ["id", "status", "kind", "type", "name", "title", "email", "platform", "website", "sku", "price", "profit", "health", "url", "created_at"];
const MAX_COLUMNS = 7;
const MAX_CELL = 48;

type Row = Record<string, unknown>;

export function toJson(value: unknown): string {
    return `${JSON.stringify(value ?? null, null, 2)}\n`;
}

function isRecord(v: unknown): v is Row {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isMoney(v: unknown): v is { amount: number; currency: string } {
    return isRecord(v) && typeof v.amount === "number" && typeof v.currency === "string" && Object.keys(v).length === 2;
}

function truncate(s: string, max = MAX_CELL): string {
    const flat = s.replace(/\s+/g, " ");
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export function formatCell(v: unknown, max = MAX_CELL): string {
    if (v === null || v === undefined) return "-";
    if (isMoney(v)) return `${v.amount.toFixed(2)} ${v.currency}`;
    if (typeof v === "object") return truncate(JSON.stringify(v), max);
    return truncate(String(v), max);
}

const isScalar = (v: unknown): boolean => v === null || ["string", "number", "boolean"].includes(typeof v) || isMoney(v);

/** Columns: preferred keys first, then other scalar fields, never `object`. */
export function pickColumns(rows: readonly Row[]): string[] {
    const keys: string[] = [];
    for (const r of rows) for (const k of Object.keys(r)) if (!keys.includes(k)) keys.push(k);
    const scalarKeys = keys.filter((k) => k !== "object" && rows.some((r) => r[k] !== undefined && isScalar(r[k])));
    const preferred = PREFERRED.filter((k) => scalarKeys.includes(k));
    return [...preferred, ...scalarKeys.filter((k) => !preferred.includes(k))].slice(0, MAX_COLUMNS);
}

/** Color a rendered cell by what its column means (status word, profit sign, health flag). Applied to the already-padded text, so alignment never sees escape codes. */
function colorCell(key: string, raw: unknown, formatted: string, colors: Colors): string {
    if (!colors.enabled) return formatted;
    if (key === "status") return paintStatus(colors, formatted);
    if (key === "profit" && isMoney(raw)) return paintSigned(colors, raw.amount, formatted);
    if (key === "health" && typeof raw === "string") return raw === "ok" ? colors.green(formatted) : colors.yellow(formatted);
    return formatted;
}

export function renderTable(rows: readonly Row[], columns: readonly string[] = pickColumns(rows), colors: Colors = NO_COLORS): string {
    if (rows.length === 0) return "(no results)\n";
    if (columns.length === 0) return rows.map((r) => formatCell(r, 120)).join("\n") + "\n";
    const plain = rows.map((r) => columns.map((c) => formatCell(r[c])));
    const header = columns.map((c) => c.toUpperCase());
    const widths = columns.map((_c, i) => Math.max(header[i]?.length ?? 0, ...plain.map((row) => row[i]?.length ?? 0)));
    const pad = (v: string, i: number): string => v.padEnd(widths[i] ?? 0);
    const headerLine = header.map((h, i) => pad(h, i)).join("  ").trimEnd();
    const bodyLines = rows.map((r, ri) => columns.map((c, i) => colorCell(c, r[c], pad(plain[ri]?.[i] ?? "", i), colors)).join("  ").trimEnd());
    return [headerLine, ...bodyLines].join("\n") + "\n";
}

export function renderObject(obj: Row, colors: Colors = NO_COLORS): string {
    const keys = Object.keys(obj).filter((k) => k !== "object");
    const width = Math.max(0, ...keys.map((k) => k.length));
    const lines = keys.map((k) => `${k.padEnd(width)}  ${colorCell(k, obj[k], formatCell(obj[k], 100), colors)}`);
    const kind = typeof obj.object === "string" ? `${obj.object}\n` : "";
    return `${kind}${lines.join("\n")}\n`;
}

interface ListLike {
    object: "list";
    data: unknown[];
    has_more?: boolean;
    next_cursor?: string | null;
}

export function isList(v: unknown): v is ListLike {
    return isRecord(v) && v.object === "list" && Array.isArray(v.data);
}

/** Human rendering of any API response. */
export function renderHuman(value: unknown, colors: Colors = NO_COLORS): string {
    if (value === undefined || value === null) return "OK\n";
    if (isList(value)) {
        const rows = value.data.filter(isRecord);
        const more = value.has_more && value.next_cursor ? `\n… more results: add --all, or --cursor ${value.next_cursor}\n` : "";
        return renderTable(rows, pickColumns(rows), colors) + more;
    }
    if (Array.isArray(value)) {
        const rows = value.filter(isRecord);
        return renderTable(rows, pickColumns(rows), colors);
    }
    if (isRecord(value)) return renderObject(value, colors);
    return `${String(value)}\n`;
}
