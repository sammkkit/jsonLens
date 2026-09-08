import { useEffect, useMemo, useRef, useState } from 'react'
import type { ActionGroup, ActionSet, AppAction } from '../actions/useActions'
import { displayChord } from '../lib/keys'
import { useAppState, useDispatch } from '../state/store'
import { useUi } from '../state/ui'

const MENUS: ActionGroup[] = ['File', 'Edit', 'JSON', 'View', 'Compare', 'Help']

export function MenuBar({ actions }: { actions: ActionSet }) {
  const { mode, settings } = useAppState()
  const dispatch = useDispatch()
  const ui = useUi()
  const barRef = useRef<HTMLDivElement>(null)

  const grouped = useMemo(() => {
    const map = new Map<ActionGroup, AppAction[]>()
    for (const action of actions.list) {
      const bucket = map.get(action.group)
      if (bucket) bucket.push(action)
      else map.set(action.group, [action])
    }
    return map
  }, [actions])

  useEffect(() => {
    if (!ui.openMenu) return
    const onPointerDown = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) ui.setOpenMenu(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [ui])

  const step = (delta: number) => {
    const index = MENUS.indexOf(ui.openMenu as ActionGroup)
    if (index < 0) return
    ui.setOpenMenu(MENUS[(index + delta + MENUS.length) % MENUS.length])
  }

  const paletteKey = actions.byId.get('help.palette')?.keys?.[0]

  return (
    <div className="menubar" ref={barRef}>
      <div className="brand">
        <span className="brand-mark">◆</span>
        JsonLens
        <span className="brand-sub">JSON editor &amp; diff</span>
      </div>

      {MENUS.map((menu) => (
        <Menu
          key={menu}
          label={menu}
          items={grouped.get(menu) ?? []}
          open={ui.openMenu === menu}
          onOpen={() => ui.setOpenMenu(ui.openMenu === menu ? null : menu)}
          onHover={() => ui.openMenu && ui.setOpenMenu(menu)}
          onClose={() => ui.setOpenMenu(null)}
          onStep={step}
        />
      ))}

      <div className="menubar-spacer" />

      {mode === 'diff' && (
        <div className="segmented" role="group" aria-label="Diff layout">
          <button
            type="button"
            aria-pressed={settings.layout === 'split'}
            onClick={() => dispatch({ type: 'settings', patch: { layout: 'split' } })}
          >
            Side by Side
          </button>
          <button
            type="button"
            aria-pressed={settings.layout === 'unified'}
            onClick={() => dispatch({ type: 'settings', patch: { layout: 'unified' } })}
          >
            Unified
          </button>
        </div>
      )}

      {mode !== 'landing' && (
        <div className="segmented" role="group" aria-label="Mode" style={{ marginLeft: 6 }}>
          <button
            type="button"
            aria-pressed={mode === 'edit'}
            onClick={() => actions.run('compare.close')}
          >
            Editor
          </button>
          <button
            type="button"
            aria-pressed={mode === 'diff'}
            onClick={() => actions.run('compare.start')}
          >
            Compare
          </button>
        </div>
      )}

      <button
        type="button"
        className="menu-button"
        style={{ marginLeft: 6 }}
        onClick={() => actions.run('help.palette')}
        title="Search all actions"
      >
        Find Action{paletteKey ? ` ${displayChord(paletteKey)}` : ''}
      </button>

      <button
        type="button"
        className="icon-button"
        onClick={() => actions.run('view.theme')}
        title={settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        aria-label="Toggle theme"
      >
        {settings.theme === 'dark' ? <MoonIcon /> : <SunIcon />}
      </button>

      <button
        type="button"
        className="icon-button"
        onClick={() => actions.run('help.shortcuts')}
        title="Keyboard shortcuts"
        aria-label="Keyboard shortcuts"
      >
        <KeyboardIcon />
      </button>
    </div>
  )
}

interface MenuProps {
  label: string
  items: AppAction[]
  open: boolean
  onOpen: () => void
  onHover: () => void
  onClose: () => void
  onStep: (delta: number) => void
}

function Menu({ label, items, open, onOpen, onHover, onClose, onStep }: MenuProps) {
  const [active, setActive] = useState(-1)

  // Every path that opens this menu goes through here, so the highlight always
  // starts clean without needing an effect to watch `open`.
  const openFresh = (open: () => void) => () => {
    setActive(-1)
    open()
  }

  const move = (delta: number) => {
    if (items.length === 0) return
    let next = active
    for (let step = 0; step < items.length; step++) {
      next = (next + delta + items.length) % items.length
      if (items[next].enabled) break
    }
    setActive(next)
  }

  // Focus stays on the menu button while the popup is open, so navigation is
  // handled on the shared root rather than on the popup itself.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        onOpen()
      }
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      move(-1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      onStep(event.key === 'ArrowLeft' ? -1 : 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      const item = items[active]
      if (item?.enabled) {
        event.preventDefault()
        onClose()
        item.run()
      }
    }
  }

  return (
    <div className="menu-root" onKeyDown={onKeyDown}>
      <button
        type="button"
        className="menu-button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={openFresh(onOpen)}
        onPointerEnter={openFresh(onHover)}
      >
        {label}
      </button>

      {open && (
        <div className="menu-popup" role="menu">
          {items.map((item, index) => (
            <div key={item.id}>
              {item.separatorBefore && index > 0 && <div className="menu-separator" />}
              <button
                type="button"
                role="menuitem"
                className="menu-item"
                disabled={!item.enabled}
                data-active={index === active}
                onPointerEnter={() => setActive(index)}
                onClick={() => {
                  onClose()
                  item.run()
                }}
              >
                <span className="menu-item-check">{item.checked ? '✓' : ''}</span>
                <span className="menu-item-label">{item.title}</span>
                {item.keys?.[0] && (
                  <span className="menu-item-key">{displayChord(item.keys[0])}</span>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1m11-5-1.1 1.1M5.1 10.9 4 12m8 0-1.1-1.1M5.1 5.1 4 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function KeyboardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M4 6h.01M6.5 6h.01M9 6h.01M11.5 6h.01M4 8.5h.01M6.5 8.5h.01M9 8.5h.01M11.5 8.5h.01M5.5 10.8h5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}
