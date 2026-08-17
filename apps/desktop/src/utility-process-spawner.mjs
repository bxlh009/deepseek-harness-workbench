import { EventEmitter } from 'node:events'

/**
 * Adapt Electron's ASAR-aware utility process to the ChildProcess surface used
 * by HostSupervisor. The command argument is intentionally ignored because the
 * first argument is the module that utilityProcess.fork loads.
 */
export function createUtilityProcessSpawner(utilityProcess) {
  return (_command, args, options) => {
    const [modulePath, ...moduleArguments] = args
    if (modulePath === undefined) throw new Error('DeepSeek Harness Host entry is missing.')

    const utility = utilityProcess.fork(modulePath, moduleArguments, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      serviceName: 'DeepSeek Harness Host',
    })
    const child = new EventEmitter()
    child.stdout = utility.stdout
    child.stderr = utility.stderr
    child.exitCode = null
    child.signalCode = null
    Object.defineProperty(child, 'pid', { get: () => utility.pid })
    child.kill = () => utility.kill()

    utility.on('spawn', () => child.emit('spawn'))
    utility.on('exit', (code) => {
      child.exitCode = code
      child.emit('close', code, null)
    })
    utility.on('error', (type, location, report) => {
      child.emit('error', new Error(`${type} at ${location}\n${report}`))
    })
    return child
  }
}
