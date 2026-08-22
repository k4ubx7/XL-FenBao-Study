import type { DownloadTask, QualityPreset } from '../../../shared/contracts'
import { Icon } from './Icons'

const qualityNames: Record<QualityPreset, string> = {
  low: '省空间',
  medium: '720p',
  high: '1080p',
  best: '最高画质'
}

function statusText(task: DownloadTask): string {
  switch (task.status) {
    case 'resolving':
      return '正在识别'
    case 'queued':
      return '等待中'
    case 'downloading':
      return `下载中 · ${Math.round(task.progress?.percent ?? 0)}%`
    case 'merging':
      return '正在合并音视频'
    case 'transcoding':
      return '正在整理为 MP4'
    case 'paused':
      return '已暂停'
    case 'completed':
      return '已完成'
    case 'cancelled':
      return '已取消'
    case 'failed':
      return '下载失败'
  }
}

function statusTone(task: DownloadTask): string {
  if (task.status === 'completed') return 'success'
  if (task.status === 'failed') return 'danger'
  if (task.status === 'paused' || task.status === 'cancelled') return 'muted'
  return 'active'
}

function taskGlyph(task: DownloadTask): string {
  const value = task.metadata.platform.trim()
  return value ? value.slice(0, 1).toUpperCase() : 'V'
}

export function TaskRow({ task }: { task: DownloadTask }): React.JSX.Element {
  const percent = Math.round(task.progress?.percent ?? 0)
  const active = ['downloading', 'merging', 'transcoding'].includes(task.status)

  return (
    <article className={`task-row tone-${statusTone(task)}`}>
      <div className="task-glyph" aria-hidden="true">
        {taskGlyph(task)}
      </div>

      <div className="task-content">
        <div className="task-heading">
          <div>
            <h3>{task.metadata.title}</h3>
            <p>
              {task.metadata.platform} · {task.metadata.author} ·{' '}
              {qualityNames[task.quality]}
            </p>
          </div>
          <span className="task-status">{statusText(task)}</span>
        </div>

        {(active || task.status === 'paused') && (
          <div
            aria-label="下载进度"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={percent}
            className="progress-track"
            role="progressbar"
          >
            <span style={{ width: `${percent}%` }} />
          </div>
        )}

        {task.error && <p className="task-error">{task.error.message}</p>}
        {task.status === 'completed' && task.outputPath && (
          <p className="saved-path" title={task.outputPath}>
            {task.outputPath}
          </p>
        )}
      </div>

      <div className="task-actions">
        {['queued', 'downloading', 'merging', 'transcoding'].includes(
          task.status
        ) && (
          <button
            aria-label={`取消 ${task.metadata.title}`}
            className="icon-button"
            onClick={() => void window.fenbao.cancelTask(task.taskId)}
            title="取消任务"
            type="button"
          >
            <Icon name="close" size={18} />
          </button>
        )}
        {task.status === 'paused' && (
          <button
            className="text-button"
            onClick={() => void window.fenbao.resumeTask(task.taskId)}
            type="button"
          >
            <Icon name="download" size={17} />
            继续
          </button>
        )}
        {task.status === 'failed' && (
          <button
            aria-label={`重试 ${task.metadata.title}`}
            className="text-button"
            onClick={() => void window.fenbao.retryTask(task.taskId)}
            type="button"
          >
            <Icon name="retry" size={17} />
            重试
          </button>
        )}
        {task.status === 'completed' && (
          <button
            aria-label={`打开 ${task.metadata.title} 的文件夹`}
            className="text-button"
            onClick={() => void window.fenbao.openTaskFolder(task.taskId)}
            type="button"
          >
            <Icon name="folder" size={17} />
            打开
          </button>
        )}
      </div>
    </article>
  )
}
