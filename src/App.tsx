import { useActions } from './actions/useActions'
import { ChangesPanel } from './components/ChangesPanel'
import { CommandPalette } from './components/CommandPalette'
import { DiffPane } from './components/DiffPane'
import { DropOverlay } from './components/DropOverlay'
import { EditorPane } from './components/EditorPane'
import { Landing } from './components/Landing'
import { MenuBar } from './components/MenuBar'
import { ShortcutsDialog } from './components/ShortcutsDialog'
import { StatusBar } from './components/StatusBar'
import { useHotkeys } from './hooks/useHotkeys'
import { AnalysisProvider } from './state/analysis'
import { StoreProvider, useAppState } from './state/store'
import { UiProvider, useUi } from './state/ui'

export default function App() {
  return (
    <StoreProvider>
      <UiProvider>
        <AnalysisProvider>
          <Workbench />
        </AnalysisProvider>
      </UiProvider>
    </StoreProvider>
  )
}

function Workbench() {
  const { mode, settings } = useAppState()
  const ui = useUi()
  const actions = useActions()
  useHotkeys(actions)

  return (
    <div className="app">
      <MenuBar actions={actions} />

      <main className="workspace">
        {mode === 'landing' && <Landing actions={actions} />}
        {mode === 'edit' && <EditorPane />}
        {mode === 'diff' && (
          <>
            <DiffPane />
            {settings.showChanges && <ChangesPanel actions={actions} />}
          </>
        )}
      </main>

      <StatusBar />

      {ui.overlay === 'palette' && <CommandPalette actions={actions} />}
      {ui.overlay === 'shortcuts' && <ShortcutsDialog actions={actions} />}
      <DropOverlay />
    </div>
  )
}
