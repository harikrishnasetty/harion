type Level = 'debug' | 'info' | 'warn' | 'error'

function emit(level: Level, scope: string, ...args: unknown[]): void {
  const ts = new Date().toISOString()
  const line = `[${ts}] [${level.toUpperCase()}] [${scope}]`
  const fn =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  fn(line, ...args)
}

export function createLogger(scope: string) {
  return {
    debug: (...a: unknown[]) => emit('debug', scope, ...a),
    info: (...a: unknown[]) => emit('info', scope, ...a),
    warn: (...a: unknown[]) => emit('warn', scope, ...a),
    error: (...a: unknown[]) => emit('error', scope, ...a)
  }
}

export type Logger = ReturnType<typeof createLogger>
