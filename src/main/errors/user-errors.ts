export type UserErrorCode =
  | 'NO_URL'
  | 'UNSUPPORTED_URL'
  | 'AUTH_REQUIRED'
  | 'DISK_FULL'
  | 'OUTPUT_NOT_WRITABLE'
  | 'NETWORK_FAILED'
  | 'POSTPROCESS_FAILED'
  | 'PROCESS_FAILED'

export class UserFacingError extends Error {
  override readonly name = 'UserFacingError'

  constructor(
    readonly code: UserErrorCode,
    message: string
  ) {
    super(message)
  }
}

const messages: Record<UserErrorCode, string> = {
  NO_URL: '没有识别到视频链接，请粘贴完整链接或整段分享文案。',
  UNSUPPORTED_URL: '这个链接暂不受支持，请确认它是公开的视频页面。',
  AUTH_REQUIRED: '该视频需要登录或账号验证，当前版本不会读取你的浏览器账号。',
  DISK_FULL: '保存位置空间不足，请清理空间或在设置中更换文件夹。',
  OUTPUT_NOT_WRITABLE: '保存位置无法写入，请在设置中选择其他文件夹。',
  NETWORK_FAILED: '网络连接失败，已自动重试；请稍后再试。',
  POSTPROCESS_FAILED: '视频已获取，但整理为 MP4 时失败，请重试。',
  PROCESS_FAILED: '下载工具未能完成任务，请检查链接后重试。'
}

function classify(message: string): UserErrorCode {
  if (/(没有.*链接|no url|no link)/iu.test(message)) return 'NO_URL'
  if (/(unsupported url|unsupported site|not supported)/iu.test(message)) {
    return 'UNSUPPORTED_URL'
  }
  if (
    /(sign.?in|log.?in|login|cookies?|account|authentication|confirm you are not a bot)/iu.test(
      message
    )
  ) {
    return 'AUTH_REQUIRED'
  }
  if (/(enospc|no space|disk full|空间不足)/iu.test(message)) {
    return 'DISK_FULL'
  }
  if (/(eacces|eperm|not writable|permission denied|output folder)/iu.test(message)) {
    return 'OUTPUT_NOT_WRITABLE'
  }
  if (/(ffmpeg|post.?process|merg(?:e|er)|convertor|remux)/iu.test(message)) {
    return 'POSTPROCESS_FAILED'
  }
  if (
    /(network|timed? ?out|timeout|connection|dns|temporary failure|http error 5\d\d)/iu.test(
      message
    )
  ) {
    return 'NETWORK_FAILED'
  }
  return 'PROCESS_FAILED'
}

export function toUserFacingError(error: unknown): UserFacingError {
  if (error instanceof UserFacingError) return error

  const rawMessage = error instanceof Error ? error.message : String(error)
  const code = classify(rawMessage)
  return new UserFacingError(code, messages[code])
}
