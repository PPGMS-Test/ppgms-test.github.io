import { Sun, Moon } from 'lucide-react'

interface ThemeToggleProps {
  isDark: boolean
  onToggle: () => void
}

export function ThemeToggle({ isDark, onToggle }: ThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      title={isDark ? '切换到亮色模式' : '切换到暗色模式'}
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 1000,
        width: 44,
        height: 44,
        borderRadius: '50%',
        border: '1px solid var(--border-color)',
        background: 'var(--card-bg)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'var(--shadow-md)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        color: 'var(--text-color)',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  )
}
