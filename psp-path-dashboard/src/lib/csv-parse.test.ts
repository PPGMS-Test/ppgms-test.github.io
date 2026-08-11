import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv-parse'

describe('parseCsv', () => {
  it('解析简单的逗号分隔内容，第一行是表头', () => {
    const result = parseCsv('name,amount\nAlice,100\nBob,200')
    expect(result.headers).toEqual(['name', 'amount'])
    expect(result.rows).toEqual([
      ['Alice', '100'],
      ['Bob', '200'],
    ])
  })

  it('支持带引号的字段（字段内含逗号）', () => {
    const result = parseCsv('name,note\n"Smith, John",hello')
    expect(result.rows).toEqual([['Smith, John', 'hello']])
  })

  it('支持引号内的转义引号（连续两个双引号表示一个字面双引号）', () => {
    const result = parseCsv('name,note\n"Say ""hi""",ok')
    expect(result.rows).toEqual([['Say "hi"', 'ok']])
  })

  it('忽略末尾空行', () => {
    const result = parseCsv('a,b\n1,2\n')
    expect(result.rows).toEqual([['1', '2']])
  })

  it('空字符串输入返回空表头和空行', () => {
    const result = parseCsv('')
    expect(result.headers).toEqual([])
    expect(result.rows).toEqual([])
  })

  it('支持 CRLF 换行', () => {
    const result = parseCsv('a,b\r\n1,2\r\n3,4')
    expect(result.rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ])
  })
})
