// Electron 主进程 —— 幕后 · 文字剧场
const { app, BrowserWindow, Menu, shell, ipcMain, protocol, net, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')

// 开发：跑 vite dev server；打包后：用 app:// 自定义协议加载 dist
const isDev = !app.isPackaged && process.env.MUHOU_FORCE_PROD !== '1' && !process.argv.includes('--prod')
const DIST_DIR = path.join(__dirname, '../dist')

// 必须在 ready 之前注册：app:// 视为安全上下文，才能用 fetch / IndexedDB 等能力
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
])

// 无边框窗口：菜单在页面内，这里只保留窗口控制能力
function currentWindow(event) {
  return BrowserWindow.fromWebContents(event.sender)
}

function registerWindowIpc() {
  ipcMain.on('win:minimize', (e) => currentWindow(e)?.minimize())
  ipcMain.on('win:toggle-maximize', (e) => {
    const win = currentWindow(e)
    if (!win) return
    if (win.isFullScreen()) {
      win.setFullScreen(false)
      return
    }
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })
  ipcMain.on('win:close', (e) => currentWindow(e)?.close())
  ipcMain.handle('win:is-maximized', (e) => !!currentWindow(e)?.isMaximized())

  ipcMain.on('view:zoom', (e, direction) => {
    const wc = e.sender
    const level = wc.getZoomLevel()
    if (direction === 'reset') wc.setZoomLevel(0)
    else wc.setZoomLevel(Math.max(-3, Math.min(3, level + (direction === 'in' ? 0.5 : -0.5))))
  })
  ipcMain.on('view:fullscreen', (e) => {
    const win = currentWindow(e)
    if (win) win.setFullScreen(!win.isFullScreen())
  })
}

// ========== 文件 IPC：安全的另存为 / 写文件 / 读文件 ==========
// 只暴露这 3 个能力，不暴露 fs/path/child_process
function registerFileIpc() {
  // 弹出"另存为"对话框 → 返回 { canceled, filePath }
  ipcMain.handle('save-dialog', async (_e, opts = {}) => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showSaveDialog(win, {
      title: opts.title || '保存文件',
      defaultPath: opts.defaultPath || app.getPath('downloads'),
      filters: opts.filters || [],
      properties: [],
    })
    return result
  })

  // 弹出"打开文件"对话框 → 返回 { canceled, filePaths }
  ipcMain.handle('open-dialog', async (_e, opts = {}) => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win, {
      title: opts.title || '打开文件',
      defaultPath: opts.defaultPath || app.getPath('documents'),
      filters: opts.filters || [],
      properties: opts.properties || ['openFile'],
    })
    return result
  })

  // 安全写文件：防目录穿越 + 自动创建父目录
  ipcMain.handle('write-file', async (_e, { filePath, data, encoding } = {}) => {
    try {
      if (!filePath) return { ok: false, error: '缺少文件路径' }
      // 防目录穿越：确保目标在允许的根目录里
      const allowedRoots = [
        app.getPath('documents'),
        app.getPath('downloads'),
        app.getPath('desktop'),
        app.getPath('pictures'),
      ]
      const absPath = path.resolve(filePath)
      const inAllowed = allowedRoots.some(root => absPath.startsWith(root + path.sep) || absPath === root)
      if (!inAllowed) {
        return { ok: false, error: '目标路径不在允许范围内（文档/下载/桌面/图片）' }
      }
      // 自动创建父目录
      const dir = path.dirname(absPath)
      await fs.promises.mkdir(dir, { recursive: true })
      // 写入（data 是 ArrayBuffer，encoding 留空写 binary；是 string 用 utf8）
      if (encoding === 'utf8' || typeof data === 'string') {
        await fs.promises.writeFile(absPath, String(data), 'utf8')
      } else {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
        await fs.promises.writeFile(absPath, buf)
      }
      return { ok: true, filePath: absPath }
    } catch (err) {
      return { ok: false, error: String(err?.message || err) }
    }
  })

  // 同步版本：beforeunload 用（只能写 userData 下的 sync 备份）
  ipcMain.on('write-file-sync', (_e, { name, data } = {}) => {
    try {
      const safeName = String(name || 'latest.md').replace(/[\\/:*?"<>|]/g, '_')
      const file = path.join(app.getPath('userData'), 'sync-latest', safeName)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, String(data || ''), 'utf8')
    } catch (err) {
      console.warn('[sync-write] 失败', err)
    }
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    frame: false,
    backgroundColor: '#0C0C0F',
    title: '幕后 · 文字剧场',
    icon: path.join(__dirname, '../build/icon.png'),
    // 全平台窗口圆角（Win11 / macOS 原生支持；Win10 忽略该属性不影响）
    roundedCorners: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      enableWebSQL: false,
      // 以下默认 false，显式写明防回归
      spellcheck: false,
      devTools: isDev, // 生产环境硬关 DevTools
    },
  })

  // 无原生菜单：文件 / 编辑 / 查看 / 帮助 全部做在页面标题栏里
  win.setMenuBarVisibility(false)

  const sendMaxState = () => {
    if (!win.isDestroyed()) win.webContents.send('win:max-state', win.isMaximized())
  }
  win.on('maximize', sendMaxState)
  win.on('unmaximize', sendMaxState)
  win.on('enter-full-screen', sendMaxState)
  win.on('leave-full-screen', sendMaxState)

  // 无菜单后补上常用快捷键
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return
    const key = String(input.key || '').toLowerCase()
    if (key === 'f11') {
      win.setFullScreen(!win.isFullScreen())
      e.preventDefault()
    } else if (isDev && (key === 'f12' || (input.control && input.shift && key === 'i'))) {
      win.webContents.toggleDevTools()
      e.preventDefault()
    }
  })

  // 生产环境硬关 DevTools 入口
  if (!isDev) {
    win.webContents.on('context-menu', (e) => e.preventDefault())
    win.webContents.on('devtools-opened', () => {
      win.webContents.closeDevTools()
    })
    // CSP 安全头（只在 app:// 协议加载时生效）
    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      const headers = { ...details.responseHeaders }
      headers['content-security-policy'] = [
        "default-src 'self' app: data: blob:",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // React 需要 eval
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' app: data: blob: https:",
        "font-src 'self' app: data:",
        "connect-src 'self' app: https:",
        "media-src 'self' app: data: blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
      ].join('; ')
      callback({ responseHeaders: headers })
    })
  }

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadURL('app://muhou/')
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // 冒烟自检：MUHOU_SMOKE=1 时加载完打印页面状态并退出（用于验证打包产物）
  if (process.env.MUHOU_SMOKE === '1') {
    const report = (info) => {
      console.log('[SMOKE]', JSON.stringify(info))
      if (process.env.MUHOU_SMOKE_LOG) {
        try { fs.writeFileSync(process.env.MUHOU_SMOKE_LOG, JSON.stringify(info)) } catch { /* 忽略 */ }
      }
    }
    let smokeEnteredStudio = false
    win.webContents.on('did-finish-load', async () => {
      // 冒烟模式可直接进入工作台：先注入本地激活，再跳到 /studio
      if (process.env.MUHOU_SMOKE_STUDIO === '1' && !smokeEnteredStudio) {
        smokeEnteredStudio = true
        await win.webContents.executeJavaScript(`(() => {
          if (!localStorage.getItem('scriptforge_license')) {
            localStorage.setItem('scriptforge_license', JSON.stringify({ code: 'SF-ADMIN-0000-0000', plan: 'lifetime', expires: null, role: 'admin' }))
          }
        })()`).catch(() => {})
        win.loadURL('app://muhou/studio')
        return
      }
      const page = await win.webContents
        .executeJavaScript(`(() => {
          const bar = document.querySelector('.app-drag')
          const btns = Array.from(document.querySelectorAll('button[title="最小化"], button[title="最大化"], button[title="关闭"]'))
          const scrollers = Array.from(document.querySelectorAll('.workbench *')).filter((el) => {
            const s = getComputedStyle(el)
            return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight - el.clientHeight > 4
          })
          return {
            url: location.href,
            mounted: !!(document.querySelector('#root') && document.querySelector('#root').children.length),
            title: document.title,
            electronAPI: !!(window.electronAPI && window.electronAPI.win),
            titleBarDrag: bar ? getComputedStyle(bar).webkitAppRegion : null,
            windowButtons: btns.map((b) => b.title),
            menus: Array.from(document.querySelectorAll('.app-drag button')).slice(0, 6).map((b) => b.textContent.trim()),
            scrollbarWidth: (() => {
              const el = scrollers[0]
              return el ? el.offsetWidth - el.clientWidth : 0
            })(),
          }
        })()`)
        .catch((err) => ({ error: String(err) }))
      report({
        ...page,
        frame: 'frameless',
        menuBarVisible: win.isMenuBarVisible(),
        size: win.getSize(),
      })
      setTimeout(() => app.quit(), 500)
    })
    win.webContents.on('did-fail-load', (_e, code, desc, url) => {
      report({ fail: true, code, desc, url })
      app.quit()
    })
  }
}

// 把 app://muhou/xxx 映射到 dist/xxx；找不到的路径回退 index.html，让前端路由接管
function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    const { pathname } = new URL(request.url)
    const rel = decodeURIComponent(pathname)
    let filePath = path.join(DIST_DIR, rel)

    // 防目录穿越
    if (!filePath.startsWith(DIST_DIR)) filePath = path.join(DIST_DIR, 'index.html')

    let ok = false
    try {
      ok = fs.statSync(filePath).isFile()
    } catch {
      ok = false
    }
    if (!ok) filePath = path.join(DIST_DIR, 'index.html')

    return net.fetch(pathToFileURL(filePath).toString())
  })
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.kisenseisoku.muhou')
  Menu.setApplicationMenu(null)
  registerWindowIpc()
  registerFileIpc()
  if (!isDev) registerAppProtocol()
  createWindow()

  // Mac：激活时重新开窗口（用户 Cmd+Tab 切回来）
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

// 生产环境崩溃保护
if (!isDev) {
  app.on('render-process-gone', (_e, wc, details) => {
    console.error('[CRASH]', details.reason, details.exitCode)
  })
  process.on('uncaughtException', (err) => console.error('[FATAL]', err))
  process.on('unhandledRejection', (err) => console.error('[PROMISE]', err))
}
