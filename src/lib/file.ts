export interface LoadedFile {
  name: string
  text: string
}

/** Reads a File the user dropped or picked. Nothing leaves the browser. */
export function readFile(file: File): Promise<LoadedFile> {
  return file.text().then((text) => ({ name: file.name, text }))
}

/** Opens the native picker and resolves with the chosen file, or null. */
export function pickFile(): Promise<LoadedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.jsonc,.txt,application/json,text/plain'
    input.style.display = 'none'
    let settled = false
    const finish = (value: LoadedFile | null) => {
      if (settled) return
      settled = true
      input.remove()
      resolve(value)
    }
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return finish(null)
      readFile(file).then(finish, () => finish(null))
    })
    // Fires when the picker is dismissed on browsers that support it.
    input.addEventListener('cancel', () => finish(null))
    document.body.append(input)
    input.click()
  })
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = ensureJsonExtension(filename)
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // Give the browser a beat to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function ensureJsonExtension(name: string): string {
  const trimmed = name.trim() || 'document.json'
  return /\.json$/i.test(trimmed) ? trimmed : `${trimmed}.json`
}

/** True when a drag event is carrying files (as opposed to selected text). */
export function isFileDrag(event: DragEvent): boolean {
  const types = event.dataTransfer?.types
  return !!types && Array.prototype.includes.call(types, 'Files')
}
