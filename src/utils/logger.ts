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

  info = (...msgs: Message[]) => {
    if (!this.canLog(LogLevel.info)) return
    const msg = this.format(msgs)
    console.warn(chalk.blue(`${this.name} Info: `) + msg)
  }

  warn = (...msgs: Message[]) => {
    if (!this.canLog(LogLevel.warn)) return
    const msg = this.format(msgs)
    console.warn(chalk.yellow(`${this.name} Warn: `) + msg)
  }

  error = (...msgs: Message[]) => {
    if (!this.canLog(LogLevel.error)) return
    const msg = this.format(msgs)
    console.warn(chalk.red(`${this.name} Error: `) + msg)
  }
}

export const logger = new Logger()
