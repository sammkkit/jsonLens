import { useEffect } from 'react'
import type { ActionSet } from '../actions/useActions'
import { setDocText } from '../editor/documents'
import { displayChord } from '../lib/keys'
import { useDispatch } from '../state/store'
import { useUi } from '../state/ui'

export function Landing({ actions }: { actions: ActionSet }) {
  const dispatch = useDispatch()
  const ui = useUi()

  // "or paste JSON" has to actually work: with no editor mounted yet, catch the
  // paste at the document level and open what was pasted.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      const text = event.clipboardData?.getData('text/plain')
      if (!text || text.trim() === '') return
      event.preventDefault()
      setDocText('left', text)
      dispatch({ type: 'name', side: 'left', name: 'pasted.json' })
      dispatch({ type: 'mode', mode: 'edit' })
      ui.notify({ kind: 'info', text: 'Pasted JSON into the editor' })
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [dispatch, ui])

  const paletteKey = actions.byId.get('help.palette')?.keys?.[0]

  return (
    <div className="landing">
      <div className="landing-glyph" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <h1>JsonLens</h1>
      <p>Edit and compare JSON like an IDE.</p>

      <div className="landing-actions">
        <button
          type="button"
          className="landing-button"
          data-primary="true"
          onClick={() => actions.run('file.new')}
        >
          Create JSON
        </button>
        <button type="button" className="landing-button" onClick={() => actions.run('file.open')}>
          Open File…
        </button>
        <button type="button" className="landing-button" onClick={() => actions.run('file.example')}>
          Try an Example Diff
        </button>
      </div>

      <div className="landing-hints">
        <span>Drop a .json file anywhere — or paste JSON straight onto this page.</span>
        {paletteKey && (
          <span>
            Press <kbd>{displayChord(paletteKey)}</kbd> to search every action.
          </span>
        )}
        <span>Runs entirely in your browser. Your JSON stays on your device.</span>
      </div>
    </div>
  )
}
