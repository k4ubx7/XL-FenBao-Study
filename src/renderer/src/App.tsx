import { useEffect } from 'react'
import { Composer } from './components/Composer'
import { HistoryList } from './components/HistoryList'
import { QueueList } from './components/QueueList'
import { SettingsPanel } from './components/SettingsPanel'
import { Sidebar } from './components/Sidebar'
import { useFenbaoStore } from './store'

export function App(): React.JSX.Element {
  const setSnapshot = useFenbaoStore((state) => state.setSnapshot)
  const setSettings = useFenbaoStore((state) => state.setSettings)
  const mainView = useFenbaoStore((state) => state.mainView)

  useEffect(() => {
    let active = true
    void window.fenbao.getSnapshot().then((snapshot) => {
      if (active) setSnapshot(snapshot)
    })
    void window.fenbao.getSettings().then((settings) => {
      if (active) setSettings(settings)
    })
    const unsubscribe = window.fenbao.onSnapshot((snapshot) => {
      if (active) setSnapshot(snapshot)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [setSettings, setSnapshot])

  return (
    <>
      <div className="drag-strip" />
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <main className="app-shell">
        <Sidebar />
        <div className="workspace">
          {mainView === 'queue' ? (
            <>
              <Composer />
              <QueueList />
            </>
          ) : (
            <HistoryList />
          )}
          <footer className="app-footer">
            粉包学习记 · 仅下载你有权保存的公开内容
          </footer>
        </div>
      </main>
      <SettingsPanel />
    </>
  )
}
