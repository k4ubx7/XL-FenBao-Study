import type { AppSettings, QualityPreset } from '../../../shared/contracts'
import { useFenbaoStore } from '../store'
import { Icon } from './Icons'

const qualityOptions: Array<{
  value: QualityPreset
  label: string
  detail: string
}> = [
  { value: 'low', label: '省空间', detail: '最低可用画质' },
  { value: 'medium', label: '720p 标准', detail: '默认 · 清晰且省空间' },
  { value: 'high', label: '1080p 高清', detail: '适合大屏观看' },
  { value: 'best', label: '最高画质', detail: '文件可能较大' }
]

export function SettingsPanel(): React.JSX.Element | null {
  const open = useFenbaoStore((state) => state.settingsOpen)
  const settings = useFenbaoStore((state) => state.settings)
  const setSettings = useFenbaoStore((state) => state.setSettings)
  const toggleSettings = useFenbaoStore((state) => state.toggleSettings)

  if (!open) return null

  const update = async (patch: Partial<AppSettings>): Promise<void> => {
    const next = await window.fenbao.updateSettings(patch)
    setSettings(next)
  }

  return (
    <div className="settings-layer">
      <button
        aria-label="关闭设置"
        className="settings-backdrop"
        onClick={() => toggleSettings(false)}
        type="button"
      />
      <section
        aria-label="下载设置"
        aria-modal="true"
        className="settings-panel"
        role="dialog"
      >
        <header className="settings-header">
          <div>
            <p className="section-kicker">PREFERENCES</p>
            <h2>下载设置</h2>
          </div>
          <button
            aria-label="关闭设置"
            className="icon-button"
            onClick={() => toggleSettings(false)}
            type="button"
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="settings-body">
          <fieldset className="setting-group">
            <legend>默认画质</legend>
            <p>只影响新加入队列的视频。</p>
            <div className="quality-grid">
              {qualityOptions.map((option) => (
                <label
                  className={
                    settings.quality === option.value
                      ? 'quality-option is-selected'
                      : 'quality-option'
                  }
                  key={option.value}
                >
                  <input
                    aria-label={option.label}
                    checked={settings.quality === option.value}
                    name="quality"
                    onChange={() => void update({ quality: option.value })}
                    type="radio"
                    value={option.value}
                  />
                  <span className="quality-radio" />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.detail}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="setting-group">
            <label htmlFor="concurrency">同时下载</label>
            <p>网络一般时保留默认的 2 个最稳妥。</p>
            <select
              id="concurrency"
              onChange={(event) =>
                void update({
                  concurrency: Number(event.target.value) as 1 | 2 | 3
                })
              }
              value={settings.concurrency}
            >
              <option value={1}>1 个视频</option>
              <option value={2}>2 个视频（推荐）</option>
              <option value={3}>3 个视频</option>
            </select>
          </div>

          <div className="setting-group">
            <span className="setting-label">保存位置</span>
            <p>每个视频会创建一个同名文件夹。</p>
            <button
              className="folder-picker"
              onClick={async () => {
                const next = await window.fenbao.chooseDownloadRoot()
                setSettings(next)
              }}
              type="button"
            >
              <Icon name="folder" size={18} />
              <span title={settings.downloadRoot}>
                {settings.downloadRoot || '选择文件夹'}
              </span>
              <small>更改</small>
            </button>
          </div>

          <label className="switch-row">
            <span>
              <strong>完成后打开文件夹</strong>
              <small>每个任务完成时自动显示保存位置</small>
            </span>
            <input
              checked={settings.openFolderOnComplete}
              onChange={(event) =>
                void update({ openFolderOnComplete: event.target.checked })
              }
              type="checkbox"
            />
            <span className="switch" />
          </label>
        </div>

        <footer className="settings-footer">
          <span className="status-dot" />
          设置会自动保存
        </footer>
      </section>
    </div>
  )
}
