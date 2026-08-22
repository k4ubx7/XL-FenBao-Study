import { useFenbaoStore } from '../store'
import { Icon } from './Icons'
import { TaskRow } from './TaskRow'

export function QueueList(): React.JSX.Element {
  const snapshot = useFenbaoStore((state) => state.snapshot)
  const activeTasks = snapshot.tasks
  const recentHistory = snapshot.history.slice(0, 8)
  const allEmpty =
    activeTasks.length === 0 &&
    recentHistory.length === 0 &&
    snapshot.resolvingCount === 0

  return (
    <section className="queue-section" aria-labelledby="queue-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">DOWNLOADS</p>
          <h2 id="queue-title">下载队列</h2>
        </div>
        <span className="queue-summary">
          {activeTasks.length > 0
            ? `${activeTasks.length} 个任务进行中`
            : '现在没有进行中的任务'}
        </span>
      </div>

      {snapshot.resolvingCount > 0 && (
        <div className="resolving-row">
          <span className="spinner" />
          正在识别 {snapshot.resolvingCount} 条链接…
        </div>
      )}

      {allEmpty ? (
        <div className="empty-state">
          <span className="empty-icon">
            <Icon name="download" size={25} />
          </span>
          <div>
            <h3>队列准备好了</h3>
            <p>上面粘贴链接，下载进度会安静地出现在这里。</p>
          </div>
        </div>
      ) : (
        <div className="task-list">
          {activeTasks.map((task) => (
            <TaskRow key={task.taskId} task={task} />
          ))}
        </div>
      )}

      {recentHistory.length > 0 && (
        <div className="history-block">
          <div className="history-heading">
            <span>最近完成</span>
            <small>{snapshot.history.length} 条记录</small>
          </div>
          <div className="task-list is-history">
            {recentHistory.map((task) => (
              <TaskRow key={task.taskId} task={task} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
