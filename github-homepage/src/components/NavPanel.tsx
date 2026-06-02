import { useState } from 'react'
import {
  ChevronDown, ChevronRight, ExternalLink, FileText, Folder,
  Layers, Code2, Globe, CreditCard, FlaskConical, Settings, BookOpen, Zap,
  Wallet, DollarSign, ShoppingCart, Clock, Star, Database, Layout, Smartphone,
  Apple, ChevronsRight, Package, AlertCircle, CheckCircle, Droplet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { NavPanelData, NavItem, NavSubGroup } from '../types'

const PANEL_COLORS = [
  { bg: '#1976d2', accent: '#e3f2fd' },
  { bg: '#388e3c', accent: '#e8f5e9' },
  { bg: '#f57c00', accent: '#fff3e0' },
  { bg: '#7b1fa2', accent: '#f3e5f5' },
  { bg: '#c62828', accent: '#ffebee' },
  { bg: '#00838f', accent: '#e0f7fa' },
  { bg: '#558b2f', accent: '#f1f8e9' },
  { bg: '#4527a0', accent: '#ede7f6' },
]

const FALLBACK_ICONS = [Layers, Code2, Globe, CreditCard, FlaskConical, Settings, BookOpen, Zap]

// Lucide icon name → component（kebab-case 或 PascalCase 均支持）
const LUCIDE_MAP: Record<string, LucideIcon> = {
  'layers': Layers, 'code2': Code2, 'code-2': Code2,
  'globe': Globe, 'credit-card': CreditCard,
  'flask-conical': FlaskConical, 'settings': Settings,
  'book-open': BookOpen, 'zap': Zap,
  'wallet': Wallet, 'dollar-sign': DollarSign,
  'shopping-cart': ShoppingCart, 'clock': Clock,
  'star': Star, 'database': Database, 'layout': Layout,
  'smartphone': Smartphone, 'apple': Apple,
  'chevrons-right': ChevronsRight, 'package': Package,
  'alert-circle': AlertCircle, 'check-circle': CheckCircle,
  'droplet': Droplet, 'folder': Folder,
  'wrench': Wrench,
}

function toCssName(name: string) {
  // 把 PascalCase 转 kebab-case，再 toLowerCase
  return name.replace(/([A-Z])/g, m => `-${m.toLowerCase()}`).replace(/^-/, '')
}

function PanelIcon({ name, size = 20 }: { name: string; size?: number }) {
  const key = toCssName(name).toLowerCase()
  const LucideComponent = LUCIDE_MAP[key]
  if (LucideComponent) return <LucideComponent size={size} />
  // 自定义 SVG：用 mask 让任意 SVG 继承 currentColor，与 Lucide 行为一致
  return (
    <span
      role="img"
      aria-label={name}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        backgroundColor: 'currentColor',
        WebkitMaskImage: `url(/${name}.svg)`,
        maskImage: `url(/${name}.svg)`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  )
}

interface NavPanelProps {
  panel: NavPanelData
  colorIndex: number
  /** Optional dnd-kit integration: attach to root for transform/transition */
  dragNodeRef?: (node: HTMLElement | null) => void
  dragStyle?: React.CSSProperties
  /** Optional dnd-kit listeners — spread onto the header to make it the drag handle */
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  isDragging?: boolean
}

function initExpanded(panel: NavPanelData): Set<string> {
  const keys = new Set<string>()
  panel.groups.forEach((g, gi) => {
    if (g.expanded) keys.add(`g-${gi}`)
    g.items.forEach((item, ii) => {
      if (item.isFolder && item.expanded) keys.add(`g-${gi}-i-${ii}`)
    })
  })
  return keys
}

function countPanelItems(panel: NavPanelData): number {
  return panel.groups.reduce((sum, g) => sum + g.items.length, 0)
}

export function NavPanel({
  panel,
  colorIndex,
  dragNodeRef,
  dragStyle,
  dragHandleProps,
  isDragging,
}: NavPanelProps) {
  const color = PANEL_COLORS[colorIndex % PANEL_COLORS.length]
  const FallbackIcon = FALLBACK_ICONS[colorIndex % FALLBACK_ICONS.length]
  const [expanded, setExpanded] = useState<Set<string>>(() => initExpanded(panel))
  const itemCount = countPanelItems(panel)

  function toggle(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div
      ref={dragNodeRef}
      className={`panel-card${isDragging ? ' is-dragging' : ''}`}
      style={{
        ['--nav-accent' as string]: color.bg,
        background: `color-mix(in srgb, ${color.accent} 75%, var(--card-bg))`,
        ...dragStyle,
      }}
    >
      {/* Wide colored header — also the drag handle */}
      <div
        className="panel-drag-header"
        style={{ background: color.bg }}
        {...dragHandleProps}
      >
        <span style={{ display: 'inline-flex', color: '#fff', flexShrink: 0 }}>
          {panel.icon && panel.icon !== 'folder'
            ? <PanelIcon name={panel.icon} size={20} />
            : <FallbackIcon size={20} />}
        </span>
        <span className="panel-header-title">{panel.title}</span>
        {itemCount > 0 && <span className="panel-count-badge">{itemCount}</span>}
      </div>

      {/* Groups */}
      {panel.groups.map((group, gi) => {
        const groupKey = `g-${gi}`
        const isOpen = expanded.has(groupKey)

        return (
          <div key={gi} style={{ borderBottom: '1px solid var(--border-color)' }}>
            {/* Group Header - only show if more than 1 group or group title differs from panel title */}
            {(panel.groups.length > 1 || group.title !== panel.title) && (
              <button
                onClick={() => toggle(groupKey)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-color)',
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Folder size={14} color={color.bg} />
                  {group.title}
                </span>
                {isOpen ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
              </button>
            )}

            {/* Group Items — collapsible whenever a header button is shown */}
            {(isOpen || panel.groups.length === 1) && (
              <div style={{ paddingBottom: 4 }}>
                {group.items.map((item, ii) => (
                  <NavItemRow
                    key={ii}
                    item={item}
                    itemKey={`g-${gi}-i-${ii}`}
                    expanded={expanded}
                    toggle={toggle}
                    accentColor={color.bg}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface NavItemRowProps {
  item: NavItem
  itemKey: string
  expanded: Set<string>
  toggle: (key: string) => void
  accentColor: string
  indent?: number
}

function NavItemRow({ item, itemKey, expanded, toggle, accentColor, indent = 0 }: NavItemRowProps) {
  const isOpen = expanded.has(itemKey)
  const pl = 16 + indent * 12

  if (item.isFolder && item.hasChildren) {
    return (
      <div>
        <button
          onClick={() => toggle(itemKey)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: `8px 12px 8px ${pl}px`,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-color)',
            fontSize: 13,
            textAlign: 'left',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <Folder size={14} color={accentColor} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{item.text}</span>
          {isOpen ? <ChevronDown size={13} color="var(--text-muted)" /> : <ChevronRight size={13} color="var(--text-muted)" />}
        </button>

        {isOpen && (
          <div style={{ borderLeft: `2px solid ${accentColor}30`, marginLeft: pl + 7 }}>
            {item.children?.map((child, ci) => (
              <NavItemRow
                key={ci}
                item={child}
                itemKey={`${itemKey}-c-${ci}`}
                expanded={expanded}
                toggle={toggle}
                accentColor={accentColor}
                indent={indent + 1}
              />
            ))}
            {item.subGroups?.map((sg, sgi) => (
              <SubGroupSection
                key={sgi}
                subGroup={sg}
                parentKey={`${itemKey}-sg-${sgi}`}
                expanded={expanded}
                toggle={toggle}
                accentColor={accentColor}
                indent={indent + 1}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <a
      href={item.isExternal ? item.url : `/${item.url}`}
      target="_blank"
      rel="noopener noreferrer"
      className="nav-link"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: `7px 12px 7px ${pl}px`,
        color: 'var(--link-color)',
        textDecoration: 'none',
        fontSize: 13,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {item.isExternal ? <ExternalLink size={13} style={{ flexShrink: 0 }} /> : <FileText size={13} style={{ flexShrink: 0 }} />}
      <span style={{ flex: 1, wordBreak: 'break-word' }}>{item.text}</span>
    </a>
  )
}

interface SubGroupSectionProps {
  subGroup: NavSubGroup
  parentKey: string
  expanded: Set<string>
  toggle: (key: string) => void
  accentColor: string
  indent: number
}

function SubGroupSection({ subGroup, parentKey, expanded, toggle, accentColor, indent }: SubGroupSectionProps) {
  const isOpen = expanded.has(parentKey)
  const pl = 16 + indent * 12

  return (
    <div>
      <button
        onClick={() => toggle(parentKey)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: `7px 12px 7px ${pl}px`,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          textAlign: 'left',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {subGroup.title}
      </button>
      {isOpen && subGroup.items.map((item, i) => (
        <NavItemRow
          key={i}
          item={item}
          itemKey={`${parentKey}-i-${i}`}
          expanded={expanded}
          toggle={toggle}
          accentColor={accentColor}
          indent={indent + 1}
        />
      ))}
    </div>
  )
}
