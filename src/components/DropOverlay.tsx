import { useEffect, useRef, useState } from 'react'
import { setDocText, type Side } from '../editor/documents'
import { isFileDrag, readFile } from '../lib/file'
import { parseJson } from '../lib/json/parser'
import { useAppState, useDispatch } from '../state/store'
import { useUi } from '../state/ui'

/**
 * Whole-window drop target. While a file is over the page it splits into
 * labelled zones so a drop can land in a specific document — and dropping two
 * files at once opens them straight into a comparison.
 */
export function DropOverlay() {
  const { mode, names } = useAppState()
  const dispatch = useDispatch()
  const ui = useUi()
  const [dragging, setDragging] = useState(false)
  const [hot, setHot] = useState<Side | null>(null)
  const depth = useRef(0)

  useEffect(() => {
    const onDragEnter = (event: DragEvent) => {
      if (!isFileDrag(event)) return
      depth.current += 1
      setDragging(true)
    }
    const onDragLeave = (event: DragEvent) => {
      if (!isFileDrag(event)) return
      depth.current -= 1
      if (depth.current <= 0) {
        depth.current = 0
        setDragging(false)
        setHot(null)
      }
    }
    const onDragOver = (event: DragEvent) => {
      if (isFileDrag(event)) event.preventDefault()
    }
    // Without this the browser would navigate away and show the raw file.
    const onDrop = (event: DragEvent) => {
      if (!isFileDrag(event)) return
      event.preventDefault()
      depth.current = 0
      setDragging(false)
      setHot(null)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  const load = async (side: Side, file: File) => {
    const loaded = await readFile(file)
    setDocText(side, loaded.text)
    dispatch({ type: 'name', side, name: loaded.name })
    dispatch({ type: 'focus', side })
    const parsed = parseJson(loaded.text, { locations: false })
    ui.notify(
      parsed.ok
        ? { kind: 'info', text: `Opened ${loaded.name}` }
        : {
            kind: 'error',
            text: `${loaded.name}: ${parsed.error.message} (line ${parsed.error.line})`,
            goTo: { side, line: parsed.error.line },
          },
    )
    return loaded
  }

  const onZoneDrop = async (side: Side, event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    depth.current = 0
    setDragging(false)
    setHot(null)
    const files = Array.from(event.dataTransfer?.files ?? [])
    if (files.length === 0) return

    if (files.length >= 2) {
      await load('left', files[0])
      await load('right', files[1])
      dispatch({ type: 'mode', mode: 'diff' })
      ui.setChangeIndex(-1)
      return
    }

    await load(side, files[0])
    if (side === 'right') {
      dispatch({ type: 'mode', mode: 'diff' })
      ui.setChangeIndex(-1)
    } else if (mode === 'landing') {
      dispatch({ type: 'mode', mode: 'edit' })
    }
  }

  if (!dragging) return null

  const zones: { side: Side; title: string; hint: string }[] =
    mode === 'landing'
      ? [{ side: 'left', title: 'Drop JSON file here', hint: 'opens it in the editor' }]
      : mode === 'edit'
        ? [
            { side: 'left', title: `Open in editor`, hint: `replaces ${names.left}` },
            { side: 'right', title: 'Compare with this file', hint: 'opens the diff view' },
          ]
        : [
            { side: 'left', title: `Drop as ${names.left}`, hint: 'original' },
            { side: 'right', title: `Drop as ${names.right}`, hint: 'changed' },
          ]

  return (
    <div className="drop">
      {zones.map((zone, index) => (
        <div
          key={zone.side}
          className="drop-zone"
          data-hot={hot === zone.side}
          onDragEnter={() => setHot(zone.side)}
          onDragOver={(event) => {
            event.preventDefault()
            setHot(zone.side)
          }}
          onDrop={(event) => void onZoneDrop(zone.side, event)}
        >
          <strong>{zone.title}</strong>
          <span>{zone.hint}</span>
          {zones.length > 1 && index === 0 && <span>or drop two files at once</span>}
        </div>
      ))}
    </div>
  )
}
