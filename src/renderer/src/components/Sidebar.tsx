import { useFenbaoStore } from '../store'
import { Icon } from './Icons'

export function Sidebar(): React.JSX.Element {
  const snapshot = useFenbaoStore((state) => state.snapshot)
  const settings = useFenbaoStore((state) => state.settings)
  const mainView = useFenbaoStore((state) => state.mainView)
  const setMainView = useFenbaoStore((state) => state.setMainView)
  const toggleSettings = useFenbaoStore((state) => state.toggleSettings)
  const activeCount = snapshot.tasks.length

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          粉
        </span>
        <span className="brand-copy">
          <strong>粉包学习记</strong>
          <small>LINK ARCHIVE</small>
        </span>
      </div>

      <nav className="primary-nav" aria-label="主导航">
        <button
          aria-current={mainView === 'queue' ? 'page' : undefined}
          className={`nav-item${mainView === 'queue' ? ' is-active' : ''}`}
          onClick={() => setMainView('queue')}
          type="button"
        >
          <Icon name="download" />
          <span>下载队列</span>
          {activeCount > 0 && <em>{activeCount}</em>}
        </button>
        <button
          aria-current={mainView === 'history' ? 'page' : undefined}
          className={`nav-item${mainView === 'history' ? ' is-active' : ''}`}
          onClick={() => setMainView('history')}
          type="button"
        >
          <Icon name="history" />
          <span>历史记录</span>
          {snapshot.history.length > 0 && <em>{snapshot.history.length}</em>}
        </button>
      </nav>

      <div className="sidebar-spacer" />

      <div className="storage-card">
        <span className="storage-kicker">保存位置</span>
        <span className="storage-path" title={settings.downloadRoot}>
          {settings.downloadRoot || '跟随客户端文件夹'}
        </span>
      </div>

      <button
        aria-label="打开设置"
        className="settings-trigger"
        onClick={() => toggleSettings(true)}
        type="button"
      >
        <span className="settings-icon">
          <Icon name="settings" />
        </span>
        <span className="settings-copy">
          <strong>设置</strong>
          <small>画质、并发与保存位置</small>
        </span>
      </button>
    </aside>
  )
}
