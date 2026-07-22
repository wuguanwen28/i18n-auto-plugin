import readline from 'node:readline/promises'
import chalk from 'chalk'

/**
 * 阻塞询问是否覆盖(仅 TTY 环境,默认否)
 * 非 TTY(CI 等)直接返回 false,避免阻塞
 */
export const confirmOverwrite = async (message: string): Promise<boolean> => {
  if (!process.stdin.isTTY) return false
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  try {
    const answer = await rl.question(chalk.yellow(`${message} (y/N) `))
    return answer.trim().toLowerCase() === 'y'
  } finally {
    rl.close()
  }
}
