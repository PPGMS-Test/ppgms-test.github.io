import { Fragment, useMemo, useState } from 'react'
import { ArrowLeft, Download, Search, Inbox, ReceiptText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isNumericColumn, type ReconReport } from '@/lib/recon-report'

interface ReconReportViewProps {
  report: ReconReport
  fileName: string
  downloadUrl: string
  onBack: () => void
}

// 单次渲染的行数上限，超出用搜索缩小范围（避免上千 DOM 行卡顿；不静默截断，会明确提示）
const MAX_RENDER = 500

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col rounded-lg border border-line bg-surface2 px-3 py-2">
      <span className="text-[11px] uppercase tracking-wide text-muted">{label}</span>
      <span className="font-mono text-sm text-ink tabular-nums">{value}</span>
    </div>
  )
}

/**
 * 对账报告查看器：顶部「回执」卡片（报告码/账户/日期/交易数/列数 + 下载），
 * 下方账本表格（吸顶表头 + 冻结首列 + 搜索 + 点行展开完整字段）。
 * 空交易日给友好空态；非 recon 文件退化为普通表格。
 */
export function ReconReportView({ report, fileName, downloadUrl, onBack }: ReconReportViewProps) {
  const { meta, columns, rows } = report
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const withIndex = rows.map((row, idx) => ({ row, idx }))
    if (!q) return withIndex
    return withIndex.filter(({ row }) => row.some((cell) => cell.toLowerCase().includes(q)))
  }, [rows, query])

  const numericCols = useMemo(() => columns.map((c) => isNumericColumn(c)), [columns])
  const visible = filtered.slice(0, MAX_RENDER)

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1.5 text-sm text-muted transition hover:text-ink"
      >
        <ArrowLeft size={14} /> 返回列表
      </button>
      {/* 回执卡片 */}
      <div className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <ReceiptText size={20} />
            </span>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-semibold text-ink">
                  {meta.reportCode ?? '对账报告'}
                </span>
                <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
                  {report.isRecon ? '对账报告' : 'CSV 文件'}
                </span>
              </div>
              <span className="mt-0.5 break-all font-mono text-xs text-muted">{fileName}</span>
            </div>
          </div>

          <a
            href={downloadUrl}
            download={fileName}
            className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-[color:var(--on-accent)] transition hover:brightness-110"
          >
            <Download size={16} /> 下载 CSV
          </a>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Stat label="交易数" value={rows.length} />
          <Stat label="列数" value={columns.length} />
          {meta.dateLabel && <Stat label="日期" value={meta.dateLabel} />}
          {meta.account && <Stat label="账户" value={meta.account} />}
        </div>
      </div>

      {/* 空交易日 */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface p-12 text-center">
          <Inbox size={28} className="text-muted" />
          <p className="text-ink">这一天没有交易记录</p>
          <p className="text-sm text-muted">报告文件已生成，但不含任何交易明细行。</p>
        </div>
      ) : (
        <>
          {/* 搜索栏 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-xs">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setExpanded(null)
                }}
                placeholder="搜索交易…"
                className="w-full rounded-full border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-accent/60 focus:outline-none"
              />
            </div>
            <span className="font-mono text-xs text-muted tabular-nums">
              显示 {visible.length} / {rows.length} 行
            </span>
          </div>

          {/* 账本表格：吸顶表头 + 冻结首列 + 点行展开 */}
          <div className="max-h-[62vh] overflow-auto rounded-xl border border-line">
            <table className="min-w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-surface2">
                  {columns.map((col, ci) => (
                    <th
                      key={ci}
                      className={cn(
                        'whitespace-nowrap px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wide text-muted',
                        numericCols[ci] && 'text-right',
                        ci === 0 && 'sticky left-0 z-20 bg-surface2',
                      )}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(({ row, idx }) => {
                  const isOpen = expanded === idx
                  return (
                    <Fragment key={idx}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : idx)}
                        className={cn(
                          'cursor-pointer border-t border-line/60 transition',
                          isOpen ? 'bg-accent/10' : 'hover:bg-surface2/60',
                        )}
                      >
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className={cn(
                              'whitespace-nowrap px-3 py-2 font-mono text-xs text-ink',
                              numericCols[ci] && 'text-right tabular-nums',
                              ci === 0 && cn('sticky left-0', isOpen ? 'bg-surface2' : 'bg-surface'),
                            )}
                          >
                            {cell || <span className="text-muted">—</span>}
                          </td>
                        ))}
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={columns.length} className="bg-surface2/40 px-4 py-3">
                            <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                              {columns.map((col, ci) => (
                                <div
                                  key={ci}
                                  className="flex flex-col border-b border-line/40 pb-1"
                                >
                                  <span className="font-mono text-[10px] uppercase tracking-wide text-muted">
                                    {col}
                                  </span>
                                  <span className="break-all font-mono text-xs text-ink">
                                    {row[ci] || '—'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {filtered.length > MAX_RENDER && (
            <p className="text-xs text-muted">
              仅渲染前 {MAX_RENDER} 行（共 {filtered.length} 行匹配），请用搜索缩小范围。
            </p>
          )}
        </>
      )}
    </div>
  )
}
