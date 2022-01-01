class Logger {
  debug(...args: any) {
    if(process.env.NODE_ENV !== 'test') {
      console.log('debug', ...args)
    }
  }
  error(...args: any) {
    console.log('error', ...args)
  }
  info(...args: any) {
    console.log('info', ...args)
  }
}

export const logger = new Logger()
