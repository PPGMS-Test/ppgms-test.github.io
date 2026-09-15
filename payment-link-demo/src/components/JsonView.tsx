/**
 * 只读 JSON 高亮展示：用 tokenizeJson 分词，按 token 类型套用主题色，渲染进 <pre>。
 * 纯展示组件——不取数、不读 store。
 */
import { tokenizeJson, type JsonTokenType } from '@/lib/json-highlight'

const CLASS: Record<JsonTokenType, string> = {
  key: 'text-brand',
  string: 'text-verified',
  number: 'text-foreground font-medium',
  boolean: 'text-brand',
  null: 'text-muted-foreground',
  plain: 'text-muted-foreground',
}

export function JsonView({ value }: { value: unknown }) {
  const tokens = tokenizeJson(value)
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
      {tokens.map((t, i) => (
        <span key={i} className={CLASS[t.type]}>
          {t.text}
        </span>
      ))}
    </pre>
  )
}
