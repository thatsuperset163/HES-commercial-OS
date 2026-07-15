import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useSales } from '../store/SalesContext'
import { CommandPalette } from './CommandPalette'
import { ShortcutHelp } from './ShortcutHelp'
import './Layout.css'

const links = [
  { to: '/', label: 'Today', end: true },
  { to: '/prospects', label: 'Prospects' },
  { to: '/emails', label: 'Emails' },
  { to: '/analytics', label: 'Analytics' },
]

export function Layout() {
  const { resetDemo } = useSales()
  const navigate = useNavigate()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [goArmed, setGoArmed] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }

      if (typing) return

      if (e.key === '?') {
        e.preventDefault()
        setHelpOpen(true)
        return
      }

      if (e.key === 'Escape') {
        setPaletteOpen(false)
        setHelpOpen(false)
        setGoArmed(false)
        return
      }

      if (goArmed) {
        const map: Record<string, string> = {
          d: '/',
          p: '/prospects',
          e: '/emails',
          a: '/analytics',
        }
        const path = map[e.key.toLowerCase()]
        if (path) {
          e.preventDefault()
          navigate(path)
        }
        setGoArmed(false)
        return
      }

      if (e.key.toLowerCase() === 'g') {
        setGoArmed(true)
        window.setTimeout(() => setGoArmed(false), 1000)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goArmed, navigate])

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img
            src={`${import.meta.env.BASE_URL}brand/logo-lockup-white.svg`}
            alt="Harris Exterior Solutions"
          />
          <p>Commercial sales OS</p>
        </div>
        <nav className="sidebar-nav">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <a className="ghost-btn" href="/">
            ← HES HQ
          </a>
          <button type="button" className="ghost-btn" onClick={() => setPaletteOpen(true)}>
            Search <span className="kbd">⌘K</span>
          </button>
          <button type="button" className="ghost-btn" onClick={() => setHelpOpen(true)}>
            Shortcuts <span className="kbd">?</span>
          </button>
          <button type="button" className="ghost-btn" onClick={resetDemo}>
            Reset demo data
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {helpOpen && <ShortcutHelp onClose={() => setHelpOpen(false)} />}
    </div>
  )
}
