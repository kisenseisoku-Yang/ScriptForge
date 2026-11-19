const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onAction: (callback) => {
    ipcRenderer.on('action', (_e, action) => callback(action))
  },
  isElectron: true,
  platform: process.platform,

  win: {
    minimize: () => ipcRenderer.send('win:minimize'),
    toggleMaximize: () => ipcRenderer.send('win:toggle-maximize'),
    close: () => ipcRenderer.send('win:close'),
    isMaximized: () => ipcRenderer.invoke('win:is-maximized'),
    onMaximizeChange: (callback) => {
      const handler = (_e, value) => callback(value)
      ipcRenderer.on('win:max-state', handler)
      return () => ipcRenderer.removeListener('win:max-state', handler)
    },
  },

  view: {
    zoom: (direction) => ipcRenderer.send('view:zoom', direction),
    toggleFullScreen: () => ipcRenderer.send('view:fullscreen'),
  },

  // ========== 文件安全 API（问题 4 修复：最小暴露面）==========

  /**
   * 弹出系统另存为对话框
   * @param {Object} opts
   * @param {string} opts.title
   * @param {string} opts.defaultPath - 文件名或路径，如 "script.pdf"
   * @param {Array}  opts.filters - [{ name: 'PDF', extensions: ['pdf'] }]
   * @returns {Promise<{canceled: boolean, filePath: string}>}
   */
  saveDialog: (opts = {}) => ipcRenderer.invoke('save-dialog', opts),

  /**
   * 弹出系统打开文件对话框
   * @param {Object} opts
   * @param {string} opts.title
   * @param {Array}  opts.filters
   * @returns {Promise<{canceled: boolean, filePaths: string[]}>}
   */
  openDialog: (opts = {}) => ipcRenderer.invoke('open-dialog', opts),

  /**
   * 安全写文件（只能写到 Documents/Downloads/Desktop/Pictures）
   * @param {string} filePath
   * @param {ArrayBuffer|string} data
   * @param {'utf8'|undefined} encoding - 写文本传 'utf8'，写 binary 不传
   * @returns {Promise<{ok: boolean, filePath?: string, error?: string}>}
   */
  writeFile: (filePath, data, encoding) =>
    ipcRenderer.invoke('write-file', { filePath, data, encoding }),

  /**
   * 同步备份：beforeunload 时用（只写 userData 内部）
   * @param {string} name
   * @param {string} data
   */
  syncBackup: (name, data) => ipcRenderer.send('write-file-sync', { name, data }),
})
