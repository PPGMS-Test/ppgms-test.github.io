export interface ParsedCsv {
  headers: string[]
  rows: string[][]
}

/**
 * 极简 RFC4180 风格 CSV 分词：返回所有行（不区分表头）。
 * 支持带引号字段、转义引号（""）、逗号、CRLF/LF 换行。
 */
export function parseCsvRows(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  function pushField() {
    row.push(field)
    field = ''
  }
  function pushRow() {
    pushField()
    rows.push(row)
    row = []
  }

  while (i < input.length) {
    const char = input[i]

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += char
      i += 1
      continue
    }

    if (char === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (char === ',') {
      pushField()
      i += 1
      continue
    }
    if (char === '\r') {
      i += 1
      continue
    }
    if (char === '\n') {
      pushRow()
      i += 1
      continue
    }
    field += char
    i += 1
  }

  // 处理最后一行（如果输入没有以换行结尾）
  if (field.length > 0 || row.length > 0) {
    pushRow()
  }

  // 已知局限：无法区分"末尾换行产生的幽灵空行"和"真实的单列空值行/中间空行"，两者都会被这里过滤掉
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

/** 把首行当表头，其余当数据行。 */
export function parseCsv(input: string): ParsedCsv {
  const rows = parseCsvRows(input)
  if (rows.length === 0) {
    return { headers: [], rows: [] }
  }
  const [headers, ...dataRows] = rows
  return { headers, rows: dataRows }
}
