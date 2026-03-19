import { app } from 'electron'
import { appendFileSync, mkdirSync, existsSync, statSync, renameSync } from 'fs'
import { join } from 'path'

const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

function getLogsDir(): string {
  const logsDir = join(app.getPath('userData'), 'logs')
  mkdirSync(logsDir, { recursive: true })
  return logsDir
}

function rotate(logPath: string): void {
  try {
    if (existsSync(logPath) && statSync(logPath).size > MAX_SIZE_BYTES) {
      renameSync(logPath, logPath.replace('.log', '.old.log'))
    }
  } catch {}
}

function writeTo(filename: string, line: string): void {
  try {
    const logPath = join(getLogsDir(), filename)
    rotate(logPath)
    appendFileSync(logPath, line, 'utf-8')
  } catch {}
}

function line(level: string, message: string): string {
  return `[${new Date().toISOString()}] [${level}] ${message}\n`
}

export const logger = {
  info:   (msg: string) => { console.log(msg);   writeTo('modly.log', line('INFO',   msg)) },
  warn:   (msg: string) => { console.warn(msg);  writeTo('modly.log', line('WARN',   msg)) },
  error:  (msg: string) => { console.error(msg); writeTo('modly.log', line('ERROR',  msg)); writeTo('errors.log', line('ERROR', msg)) },
  python: (msg: string) => {
    writeTo('runtime.log', line('RUNTIME', msg))
    if (/error|exception|traceback|critical/i.test(msg)) {
      writeTo('errors.log', line('RUNTIME', msg))
    }
  },
}
