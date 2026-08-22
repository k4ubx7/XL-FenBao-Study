import { useFenbaoStore } from '../store'
import { Icon } from './Icons'

export function Composer(): React.JSX.Element {
  const input = useFenbaoStore((state) => state.input)
  const setInput = useFenbaoStore((state) => state.setInput)
  const submit = useFenbaoStore((state) => state.submit)
  const submitting = useFenbaoStore((state) => state.submitting)
  const resolvingCount = useFenbaoStore(
    (state) => state.snapshot.resolvingCount
  )
  const notice = useFenbaoStore((state) => state.notice)
  const error = useFenbaoStore((state) => state.error)
  const busy = submitting || resolvingCount > 0

  return (
    <section className="composer-section" aria-labelledby="composer-title">
      <div className="eyebrow">
        <Icon name="spark" size={17} />
        <span>智能识别分享文案与多个链接</span>
      </div>
      <h1 id="composer-title">把链接交给我</h1>
      <p className="hero-copy">
        粘贴抖音或其他公开网页的视频链接。粉包会自动识别、排队，
        并把每个视频整齐地收进自己的文件夹。
      </p>

      <form
        className="composer-card"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <label className="sr-only" htmlFor="video-input">
          视频链接或分享文案
        </label>
        <textarea
          autoFocus
          id="video-input"
          onChange={(event) => setInput(event.target.value)}
          placeholder={'粘贴链接或整段分享文案…\n支持一次放入多条链接'}
          rows={4}
          value={input}
        />
        <div className="composer-footer">
          <span className="privacy-note">
            <span className="status-dot" />
            登录仅保存在本机独立浏览器
          </span>
          <button
            className="primary-button"
            disabled={!input.trim() || busy}
            type="submit"
          >
            <span>{busy ? '正在识别…' : '开始下载'}</span>
            <Icon name="arrow" size={18} />
          </button>
        </div>
      </form>

      {(notice || error) && (
        <div className={error ? 'inline-message is-error' : 'inline-message'}>
          {error || notice}
        </div>
      )}
    </section>
  )
}
