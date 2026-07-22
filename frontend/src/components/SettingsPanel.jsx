import { useTheme, ACCENT_COLORS } from '../context/ThemeContext'

const MODE_OPTIONS = [
  { key: 'light',  label: 'Light',  icon: '☀️' },
  { key: 'dark',   label: 'Dark',   icon: '🌙' },
  { key: 'system', label: 'System', icon: '💻' },
]

export default function SettingsPanel({ onClose }) {
  const { accentKey, setAccent, mode, setMode } = useTheme()
  const currentAccent = ACCENT_COLORS[accentKey] || ACCENT_COLORS.purple

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '300px',
          background: 'var(--surface)',
          borderLeft: '0.5px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          animation: 'hf-slide-in 0.22s ease',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '0.5px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
              Appearance
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
              Customize your workspace
            </div>
          </div>
          <button
            onClick={onClose}
            id="close-settings-panel"
            style={{
              background: 'var(--surface-1)',
              border: '0.5px solid var(--border)',
              borderRadius: '6px', width: '28px', height: '28px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '16px',
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem 1.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Accent color */}
          <section>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
              Accent Color
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {Object.entries(ACCENT_COLORS).map(([key, color]) => {
                const isActive = accentKey === key
                return (
                  <button
                    key={key}
                    id={`accent-${key}`}
                    onClick={() => setAccent(key)}
                    style={{
                      border: isActive ? `2px solid ${color[600]}` : '0.5px solid var(--border)',
                      borderRadius: '10px',
                      padding: '10px 8px',
                      background: isActive ? color[50] : 'var(--surface-1)',
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: color.gradient,
                      boxShadow: isActive ? `0 2px 8px ${color[400]}55` : 'none',
                    }} />
                    <span style={{
                      fontSize: '11px', fontWeight: isActive ? '600' : '400',
                      color: isActive ? color[800] : 'var(--text-secondary)',
                    }}>
                      {color.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Mode */}
          <section>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
              Color Mode
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {MODE_OPTIONS.map(opt => {
                const isActive = mode === opt.key
                return (
                  <button
                    key={opt.key}
                    id={`mode-${opt.key}`}
                    onClick={() => setMode(opt.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 14px', borderRadius: '10px', cursor: 'pointer',
                      border: isActive ? `1.5px solid ${currentAccent[400]}` : '0.5px solid var(--border)',
                      background: isActive ? currentAccent[50] : 'var(--surface-1)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{opt.icon}</span>
                    <span style={{
                      fontSize: '13px',
                      color: isActive ? currentAccent[800] : 'var(--text-primary)',
                      fontWeight: isActive ? '500' : '400', flex: 1, textAlign: 'left',
                    }}>
                      {opt.label}
                    </span>
                    {isActive && (
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: currentAccent[400], flexShrink: 0,
                      }} />
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Preview chip */}
          <section>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
              Preview
            </div>
            <div style={{
              background: currentAccent.gradient,
              borderRadius: '12px', padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '9px',
                background: 'rgba(255,255,255,0.2)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', color: '#fff', fontWeight: '700',
              }}>H</div>
              <div>
                <div style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>HireFlow AI</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', marginTop: '2px' }}>{currentAccent.name} theme</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
