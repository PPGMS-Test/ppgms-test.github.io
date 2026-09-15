/**
 * 极轻量 JSON 高亮分词器（无依赖）。
 * tokenizeJson(value) 先 JSON.stringify(value, null, 2)，再用单条正则把
 * 键 / 字符串 / 数字 / 布尔 / null 切成带类型的 token，交给 <JsonView> 上色。
 * 键的判定：字符串后紧跟冒号（用 lookahead，冒号本身留给 plain）。
 */
export type JsonTokenType = 'key' | 'string' | 'number' | 'boolean' | 'null' | 'plain'

export interface JsonToken {
  text: string
  type: JsonTokenType
}

const TOKEN_RE =
  /("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|(\btrue\b|\bfalse\b)|(\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g

export function tokenizeJson(value: unknown): JsonToken[] {
  const json = JSON.stringify(value, null, 2) ?? String(value)
  const tokens: JsonToken[] = []
  let last = 0
  let m: RegExpExecArray | null
  TOKEN_RE.lastIndex = 0
  while ((m = TOKEN_RE.exec(json)) !== null) {
    if (m.index > last) tokens.push({ text: json.slice(last, m.index), type: 'plain' })
    if (m[1] !== undefined) tokens.push({ text: m[1], type: 'key' })
    else if (m[2] !== undefined) tokens.push({ text: m[2], type: 'string' })
    else if (m[3] !== undefined) tokens.push({ text: m[3], type: 'boolean' })
    else if (m[4] !== undefined) tokens.push({ text: m[4], type: 'null' })
    else if (m[5] !== undefined) tokens.push({ text: m[5], type: 'number' })
    last = m.index + m[0].length
  }
  if (last < json.length) tokens.push({ text: json.slice(last), type: 'plain' })
  return tokens
}
