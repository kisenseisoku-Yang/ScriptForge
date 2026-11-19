import React, { useEffect, useState } from 'react'
import { Minus, Square, Copy, X } from 'lucide-react'
import { useI18n } from '../i18n/index.jsx'

const electron = () => (typeof window !== 'undefined' && window.electronAPI ? window.electronAPI : null)

function WindowButtons() {
  const { t } = useI18n()
  const api = electron()
  const [maxed, setMaxed] = useState(false)

  useEffect(() => {
    if (!api?.win) return
    api.win.isMaximized().then(setMaxed).catch(() => {})
    return api.win.onMaximizeChange(setMaxed)
  }, [api])

  if (!api?.win) return null

  const btn = 'w-11 h-full flex items-center justify-center text-ivory-300 transition-colors app-no-drag'
  return (
    <div className="flex items-stretch">
      <button onClick={() => api.win.minimize()} title={t('最小化')} className={`${btn} hover:bg-white/10`}>
        <Minus size={14} />
      </button>
      <button onClick={() => api.win.toggleMaximize()} title={maxed ? t('还原') : t('最大化')} className={`${btn} hover:bg-white/10`}>
        {maxed ? <Copy size={11} /> : <Square size={11} />}
      </button>
      <button
        onClick={() => api.win.close()}
        title={t('关闭')}
        className="w-11 h-full flex items-center justify-center text-ivory-300 hover:bg-red-600 hover:text-white transition-colors app-no-drag"
      >
        <X size={15} />
      </button>
    </div>
  )
}

// bare=true 时只输出内部内容（让外层套幕布容器）
export default function TitleBar({ onSwitch, bare = false }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(null)
  const api = electron()

  const save = () => {
    const target = document.activeElement || document.body
    target.dispatchEvent(new KeyboardEvent('keydown', {
      key: 's', code: 'KeyS', keyCode: 83, which: 83, ctrlKey: true, bubbles: true,
    }))
  }
  const exec = (cmd) => { try { document.execCommand(cmd) } catch { /* 忽略 */ } }
  const zoom = (dir) => api?.view?.zoom(dir)
  const toggleFullscreen = () => {
    if (api?.view) api.view.toggleFullScreen()
    else if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.()
  }

  const MENUS = [
    { id: 'file', label: '文件', items: [
      { label: '新建剧本', hint: 'Ctrl+N', action: () => onSwitch('editor') },
      { label: '剧本架', action: () => onSwitch('shelf') },
      { divider: true },
      { label: '保存', hint: 'Ctrl+S', action: save },
      { divider: true },
      { label: '关闭窗口', hint: 'Alt+F4', action: () => (api?.win ? api.win.close() : window.close()) },
    ]},
    { id: 'edit', label: '编辑', items: [
      { label: '撤销', hint: 'Ctrl+Z', action: () => exec('undo') },
      { label: '重做', hint: 'Ctrl+Shift+Z', action: () => exec('redo') },
      { divider: true },
      { label: '剪切', hint: 'Ctrl+X', action: () => exec('cut') },
      { label: '复制', hint: 'Ctrl+C', action: () => exec('copy') },
      { label: '粘贴', hint: 'Ctrl+V', action: () => exec('paste') },
      { label: '全选', hint: 'Ctrl+A', action: () => exec('selectAll') },
    ]},
    { id: 'view', label: '查看', items: [
      { label: '放大', action: () => zoom('in') },
      { label: '缩小', action: () => zoom('out') },
      { label: '实际大小', action: () => zoom('reset') },
      { divider: true },
      { label: '全屏', hint: 'F11', action: toggleFullscreen },
    ]},
    { id: 'help', label: '帮助', items: [
      { label: '官网首页', action: () => window.open('https://37k29ecbcz6gv383755.traesite.cn/#/home', '_blank') },
      { label: '关于', action: () => window.alert('幕后 · 文字剧场\nKisenSeisoku · 2025\n电影剧本写作与分镜工作台\n6 种行业格式 · 4 种分镜视图 · 艺术壁纸库') },
    ]},
  ]

  const menus = (
    <div className="flex items-stretch app-no-drag">
      {MENUS.map(menu => (
        <div key={menu.id} className="relative flex items-stretch">
          <button
            onClick={() => setOpen(open === menu.id ? null : menu.id)}
            onMouseEnter={() => open && setOpen(menu.id)}
            className={`px-3 text-[11px] tracking-[0.1em] transition-colors h-8 flex items-center ${
              open === menu.id ? 'text-gold-400 bg-white/10' : 'text-ivory-300 hover:bg-white/10 hover:text-ivory-100'
            }`}
          >
            {t(menu.label)}
          </button>
          {open === menu.id && (
            <div className="absolute top-full left-0 w-56 menu-noir z-50 py-1">
              {menu.items.map((item, i) => item.divider ? (
                <div key={`d${i}`} className="my-1 h-px bg-noir-700" />
              ) : (
                <button
                  key={item.label}
                  onClick={() => { setOpen(null); item.action() }}
                  className="w-full flex items-center justify-between px-4 py-1.5 text-[11px] text-ivory-200 hover:bg-noir-700 hover:text-gold-400 transition-colors"
                >
                  <span>{t(item.label)}</span>
                  {item.hint && <span className="text-[9px] tracking-wider text-ivory-500">{item.hint}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )

  const backdrop = open && <div className="fixed inset-0 z-40" onClick={() => setOpen(null)} />

  if (bare) {
    // 只输出内容，不带 root div；flex-1 把三键推到最右
    return (
      <>
        {menus}
        <div className="flex-1" />
        <WindowButtons />
        {backdrop}
      </>
    )
  }

  return (
    <div className="app-drag relative z-30 h-9 flex items-stretch bg-white/8 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),inset_0_-1px_0_0_rgba(255,255,255,0.04)] select-none">
      <div className="flex items-center pl-3 pr-2">
        <span className="text-[9px] uppercase tracking-[0.3em] text-gold-500/70">{t('幕后 · 文字剧场')}</span>
      </div>
      {menus}
      <div className="flex-1" />
      <WindowButtons />
      {backdrop}
    </div>
  )
}
