import { describe, it, expect } from 'vitest'
import {
  describeReconFileName,
  formatFileSize,
  isNumericColumn,
  parseReconReport,
} from './recon-report'

describe('describeReconFileName', () => {
  it('解析 PayPal 文件名的报告码/账户/日期', () => {
    expect(describeReconFileName('PYT.20260812.HKPSP.H.0.2.0.CSV')).toEqual({
      reportCode: 'PYT',
      account: 'HKPSP',
      dateLabel: '2026-08-12',
    })
  })

  it('无法识别的字段返回 null，不报错', () => {
    expect(describeReconFileName('random-file.csv')).toEqual({
      reportCode: 'random-file',
      account: null,
      dateLabel: null,
    })
  })
})

describe('formatFileSize', () => {
  it('按 B / KB / MB 分档', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(2048)).toBe('2.0 KB')
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })
  it('非法输入返回破折号', () => {
    expect(formatFileSize(-1)).toBe('—')
    expect(formatFileSize(NaN)).toBe('—')
  })
})

describe('parseReconReport', () => {
  const reconCsv = [
    'FH,2026/08/13 05:48:53 +0800,H,,2026/08/12 00:00:00 +0800',
    'SH,section',
    'CH,TRANSACTION_TYPE,PAYPAL_TRANSACTION_ID,GROSS_AMOUNT',
    'SB,T0000,1AB23456CD789,100.00',
    'SB,T0001,2EF34567GH890,250.50',
    'SF,2',
    'FF,end',
  ].join('\n')

  it('识别记录类型格式：CH 做列名、SB 做数据行', () => {
    const r = parseReconReport(reconCsv, 'PYT.20260812.HKPSP.H.0.2.0.CSV')
    expect(r.isRecon).toBe(true)
    expect(r.columns).toEqual(['TRANSACTION_TYPE', 'PAYPAL_TRANSACTION_ID', 'GROSS_AMOUNT'])
    expect(r.rows).toEqual([
      ['T0000', '1AB23456CD789', '100.00'],
      ['T0001', '2EF34567GH890', '250.50'],
    ])
    expect(r.meta.account).toBe('HKPSP')
  })

  it('空交易日：有 CH 但没有 SB → isRecon 但 rows 为空', () => {
    const emptyDay = ['FH,gen', 'SH,s', 'CH,A,B,C', 'SF,0', 'FF,end'].join('\n')
    const r = parseReconReport(emptyDay, 'PYT.20260812.HKPSP.H.0.2.0.CSV')
    expect(r.isRecon).toBe(true)
    expect(r.columns).toEqual(['A', 'B', 'C'])
    expect(r.rows).toEqual([])
  })

  it('SB 行列数与 CH 不齐时按列名长度对齐（多截少补空）', () => {
    const jagged = ['CH,A,B,C', 'SB,1,2', 'SB,1,2,3,4'].join('\n')
    const r = parseReconReport(jagged, 'x.csv')
    expect(r.rows).toEqual([
      ['1', '2', ''],
      ['1', '2', '3'],
    ])
  })

  it('非记录类型文件退化为首行表头的普通表格', () => {
    const r = parseReconReport('name,amount\nAlice,100\nBob,200', 'plain.csv')
    expect(r.isRecon).toBe(false)
    expect(r.columns).toEqual(['name', 'amount'])
    expect(r.rows).toEqual([
      ['Alice', '100'],
      ['Bob', '200'],
    ])
  })
})

describe('isNumericColumn', () => {
  it('金额类列名判为数值列', () => {
    expect(isNumericColumn('GROSS_AMOUNT')).toBe(true)
    expect(isNumericColumn('fee_amount')).toBe(true)
    expect(isNumericColumn('TRANSACTION_TYPE')).toBe(false)
  })
})
