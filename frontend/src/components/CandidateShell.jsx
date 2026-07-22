import { useTheme } from '../context/ThemeContext'

/**
 * Shared portal shell for all candidate-facing pages.
 * Renders a gradient header card followed by a white body card.
 */
export default function CandidateShell({ header, children, maxWidth = '520px', topPad = '2rem' }) {
  const { accentObj } = useTheme()
  const gradient = accentObj?.gradient || 'linear-gradient(135deg, #7F77DD, #534AB7)'

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      padding: `${topPad} 1rem 3rem`,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
    }}>
      <div style={{ width: '100%', maxWidth }}>
        {/* Gradient header */}
        <div style={{
          background: gradient,
          borderRadius: '16px 16px 0 0',
          padding: '1.5rem 1.75rem',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative blobs */}
          <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
          <div style={{ position: 'absolute', bottom: '-20px', left: '30%', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

          {/* Powered-by label */}
          <div style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.55)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', position: 'relative' }}>
            Powered by HireFlow AI
          </div>
          <div style={{ position: 'relative' }}>{header}</div>
        </div>

        {/* Body */}
        <div style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderTop: 'none',
          borderRadius: '0 0 16px 16px',
          padding: '1.75rem',
          boxShadow: 'var(--shadow-md)',
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}
