import chalk from 'chalk'
import { LoggerLevel } from '../types'

type Message = Error | string | number

const LogLevel = {
  none: 0,
  error: 1,
  warn: 2,
  info: 3,
} as const

class Logger {
  logLevel: number = LogLevel.info
  name = chalk.bold(`[${__NAME__}]`)

  private canLog(targetLevel: number) {
    return targetLevel <= this.logLevel && this.logLevel !== LogLevel.none
  }

  setLogLevel(level?: LoggerLevel) {
    this.logLevel = LogLevel[level || 'info']
  }

  format = (msgs: Message[] = []) => {
    return msgs
      .map((item) =>
        item instanceof Error ? `${item.stack || item.message}` : item,
      )
      .join(' ')
  }

  /**
   * 命令主输出(如 check 体检报告):不受日志级别控制、无前缀。
   * 用于「以输出为目的」的命令--用户执行 check 就是为了看这份结果,
   * 不应因 logger: 'none' 或 --logger none 而被静默。
   * 与 info/warn/error(过程日志)语义区分。
   */
  print = (...msgs: Message[]) => {
    console.log(this.format(msgs))
  }

  info = (...msgs: Message[]) => {
    if (!this.canLog(LogLevel.info)) return
    const msg = this.format(msgs)
    console.log(chalk.blue(`${this.name} Info: `) + msg)
  }

  warn = (...msgs: Message[]) => {
    if (!this.canLog(LogLevel.warn)) return
    const msg = this.format(msgs)
    console.warn(chalk.yellow(`${this.name} Warn: `) + msg)
  }

  error = (...msgs: Message[]) => {
    if (!this.canLog(LogLevel.error)) return
    const msg = this.format(msgs)
    console.error(chalk.red(`${this.name} Error: `) + msg)
  }
}

export const logger = new Logger()
