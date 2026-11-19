// npm run electron:dev
// Windows 下不能用 `vite & electron .`，这里先起 vite，等端口就绪再起 electron。
const { spawn } = require('child_process')
const net = require('net')
const path = require('path')

const PORT = 5173
const ROOT = path.join(__dirname, '..')
const opts = { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' }

const vite = spawn('npx', ['vite'], opts)

function waitPort(tries = 120) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(PORT, '127.0.0.1')
      socket.once('connect', () => {
        socket.destroy()
        resolve()
      })
      socket.once('error', () => {
        socket.destroy()
        if (--tries <= 0) return reject(new Error('vite 启动超时'))
        setTimeout(attempt, 500)
      })
    }
    attempt()
  })
}

waitPort()
  .then(() => {
    const electron = spawn('npx', ['electron', '.'], opts)
    electron.on('exit', (code) => {
      vite.kill()
      process.exit(code ?? 0)
    })
  })
  .catch((err) => {
    console.error(err.message)
    vite.kill()
    process.exit(1)
  })
