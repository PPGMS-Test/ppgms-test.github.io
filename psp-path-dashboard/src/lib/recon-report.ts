import { parseCsvRows } from './csv-parse'

// PayPal 对账/交易报告是「按记录类型分行」的格式：每行第一列是 2 字母记录类型码。
// RH=Report Header, FH=File Header, SH=Section Header, CH=Column Header,
// SB=Section Body(数据行), SF=Section Footer, FF=File Footer, RF=Report Footer。
const RECORD_TYPES = new Set(['RH', 'FH', 'SH', 'CH', 'SB', 'SF', 'FF', 'RF'])

export interface ReconFileMeta {
  reportCode: string | null // 文件名首段，如 PYT
  account: string | null // 文件名里的账户/伙伴段，如 HKPSP
  dateLabel: string | null // 文件名里的日期，规整成 2026-08-12
}

export interface ReconReport {
  /** 是否识别为 PayPal 记录类型格式（否则退化为「首行当表头」的普通表格） */
  isRecon: boolean
  meta: ReconFileMeta
  /** 表格列名：recon 取 CH 行，普通文件取首行 */
  columns: string[]
  /** 数据行：recon 取全部 SB 行，普通文件取除首行外的行 */
  rows: string[][]
}

/**
 * 从文件名提取可靠的元信息（不解析 FH 行的定位字段，避免臆测出错）。
 * 形如 `PYT.20260812.HKPSP.H.0.2.0.CSV`。
 */
export function describeReconFileName(name: string): ReconFileMeta {
  const base = name.replace(/\.csv$/i, '')
  const parts = base.split('.')
  const reportCode = parts[0] || null
  const dateRaw = parts.find((p) => /^\d{8}$/.test(p)) ?? null
  const dateLabel = dateRaw
    ? `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
    : null
  // 账户段：跳过首段 reportCode，取第一个长度≥3 的全大写字母段（如 HKPSP，排除 'H'）
  const account = parts.slice(1).find((p) => /^[A-Z]{3,}$/.test(p)) ?? null
  return { reportCode, account, dateLabel }
}

/** 人类可读的文件大小。 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`
}

/**
 * 解析对账报告文本。识别 PayPal 记录类型格式时，用 CH 行做列名、SB 行做数据；
 * 否则退化为「首行表头 + 其余数据」的普通 CSV 表格。
 */
export function parseReconReport(csvText: string, fileName: string): ReconReport {
  const meta = describeReconFileName(fileName)
  const allRows = parseCsvRows(csvText)

  const typed = allRows.filter((r) => r.length > 0 && RECORD_TYPES.has(r[0]))
  const chRow = allRows.find((r) => r[0] === 'CH')
  // 需有 CH 行，且过半行是已知记录类型，才判定为 recon 格式
  const isRecon = !!chRow && typed.length >= Math.max(2, allRows.length * 0.5)

  if (isRecon && chRow) {
    const columns = chRow.slice(1)
    const rawBody = allRows.filter((r) => r[0] === 'SB').map((r) => r.slice(1))
    // 规整每个 SB 行到 columns 长度（多截、少补空），保证表格对齐
    const rows = rawBody.map((r) => {
      const out = r.slice(0, columns.length)
      while (out.length < columns.length) out.push('')
      return out
    })
    return { isRecon: true, meta, columns, rows }
  }

  if (allRows.length === 0) {
    return { isRecon: false, meta, columns: [], rows: [] }
  }
  const [headers, ...dataRows] = allRows
  return { isRecon: false, meta, columns: headers, rows: dataRows }
}

/** 数值型列的表头启发式（用于表格右对齐）。 */
export function isNumericColumn(header: string): boolean {
  return /amount|fee|gross|net|balance|price|total|qty|quantity|rate/i.test(header)
}
