import { useFenbaoStore } from '../store'
import { Icon } from './Icons'
import { TaskRow } from './TaskRow'

export function HistoryList(): React.JSX.Element {
  const history = useFenbaoStore((state) => state.snapshot.history)

  return (
    <section className="queue-section history-page" aria-labelledby="history-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">HISTORY</p>
          <h2 id="history-title">全部历史记录</h2>
        </div>
        <span className="queue-summary">{history.length} 条记录</span>
      </div>

      {history.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">
            <Icon name="history" size={25} />
          </span>
          <div>
            <h3>还没有历史记录</h3>
            <p>完成、失败或取消的任务会显示在这里。</p>
          </div>
        </div>
      ) : (
        <div className="task-list is-history">
          {history.map((task) => (
            <TaskRow key={task.taskId} task={task} />
          ))}
        </div>
      )}
    </section>
  )
}
