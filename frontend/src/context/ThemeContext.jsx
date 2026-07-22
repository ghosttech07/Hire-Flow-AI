import { createContext, useContext, useEffect, useState } from 'react'

export const ACCENT_COLORS = {
  purple: { name: 'Purple', hex: '#7F77DD', gradient: 'linear-gradient(135deg, #7F77DD, #534AB7)',
    50: '#EEEDFE', 100: '#CECBF6', 200: '#AFA9EC', 400: '#7F77DD', 600: '#534AB7', 800: '#3C3489' },
  blue:   { name: 'Blue',   hex: '#378ADD', gradient: 'linear-gradient(135deg, #378ADD, #185FA5)',
    50: '#E6F1FB', 100: '#B5D4F4', 200: '#85B7EB', 400: '#378ADD', 600: '#185FA5', 800: '#0C447C' },
  teal:   { name: 'Teal',   hex: '#1D9E75', gradient: 'linear-gradient(135deg, #1D9E75, #0F6E56)',
    50: '#E1F5EE', 100: '#9FE1CB', 200: '#5ECBAA', 400: '#1D9E75', 600: '#0F6E56', 800: '#085041' },
  coral:  { name: 'Coral',  hex: '#D85A30', gradient: 'linear-gradient(135deg, #D85A30, #993C1D)',
    50: '#FAECE7', 100: '#F5C4B3', 200: '#EF9B7D', 400: '#D85A30', 600: '#993C1D', 800: '#712B13' },
  pink:   { name: 'Pink',   hex: '#D4537E', gradient: 'linear-gradient(135deg, #D4537E, #993556)',
    50: '#FBEAF0', 100: '#F4C0D1', 200: '#ED93B1', 400: '#D4537E', 600: '#993556', 800: '#72243E' },
  amber:  { name: 'Amber',  hex: '#D4890A', gradient: 'linear-gradient(135deg, #EF9F27, #BA7517)',
    50: '#FAEEDA', 100: '#FAC775', 200: '#EF9F27', 400: '#D4890A', 600: '#954F06', 800: '#633806' },
}

const ThemeContext = createContext(null)

function getSystemMode() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [accentKey, setAccentKey] = useState(
    () => localStorage.getItem('hf-accent') || 'purple'
  )
  const [mode, setModeState] = useState(
    () => localStorage.getItem('hf-mode') || 'system'
  )
  const [resolvedMode, setResolvedMode] = useState(
    () => {
      const m = localStorage.getItem('hf-mode') || 'system'
      return m === 'system' ? getSystemMode() : m
    }
  )

  const accentObj = ACCENT_COLORS[accentKey] || ACCENT_COLORS.purple

  // Sync system preference
  useEffect(() => {
    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = e => setResolvedMode(e.matches ? 'dark' : 'light')
      mq.addEventListener('change', handler)
      setResolvedMode(mq.matches ? 'dark' : 'light')
      return () => mq.removeEventListener('change', handler)
    } else {
      setResolvedMode(mode)
    }
  }, [mode])

  // Apply dark/light to <html data-theme="...">
  useEffect(() => {
    const root = document.documentElement
    if (resolvedMode === 'dark') {
      root.setAttribute('data-theme', 'dark')
    } else {
      root.removeAttribute('data-theme')
    }
  }, [resolvedMode])

  // Apply accent CSS variables + class
  useEffect(() => {
    const root = document.documentElement
    const a = accentObj

    // CSS variables
    root.style.setProperty('--accent-50',          a[50])
    root.style.setProperty('--accent-100',         a[100])
    root.style.setProperty('--accent-200',         a[200])
    root.style.setProperty('--accent-400',         a[400])
    root.style.setProperty('--accent-600',         a[600])
    root.style.setProperty('--accent-800',         a[800])
    root.style.setProperty('--gradient-primary',   a.gradient)
    root.style.setProperty('--gradient-header',    a.gradient)
    root.style.setProperty('--sidebar-accent-bg', `${a[400]}22`)

    // Remove old theme-* classes, add current
    Object.keys(ACCENT_COLORS).forEach(k => root.classList.remove(`theme-${k}`))
    root.classList.add(`theme-${accentKey}`)

    localStorage.setItem('hf-accent', accentKey)
    localStorage.setItem('hf-mode', mode)
  }, [accentKey, mode, accentObj])

  function setAccent(key) { setAccentKey(key) }
  function setMode(m)     { setModeState(m) }

  return (
    <ThemeContext.Provider value={{
      // New API
      accentKey, accentObj, setAccent,
      mode, setMode, resolvedMode,
      ACCENT_COLORS,
      // Legacy aliases so existing code still works
      accent: accentKey,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
