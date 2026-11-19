﻿﻿import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { FileText, Film, BookOpen, Clapperboard, Palette, User, Plus, X, MoreHorizontal, ChevronDown, Layers, Settings as SettingsIcon } from 'lucide-react'
import { useLicense } from '../utils/LicenseContext.jsx'
import { useTabs, getTypeMeta } from '../utils/tabs.js'
import WallpaperPicker, { loadWallpaper, saveWallpaper } from './WallpaperPicker.jsx'
import { getArtById } from '../utils/artLibrary.js'
import ScriptEditor from '../pages/ScriptEditor.jsx'
import Timeline from '../pages/Timeline.jsx'
import StoryboardEditor from '../pages/StoryboardEditor.jsx'
import ScriptShelf from '../pages/ScriptShelf.jsx'
import StyleLibrary from '../pages/StyleLibrary.jsx'
import UpgradeModal from './UpgradeModal.jsx'
import CheckoutModal from './CheckoutModal.jsx'
import SettingsModal from './SettingsModal.jsx'
import TitleBar from './TitleBar.jsx'
import WeatherCanvas, { useAutoWeather } from './WeatherCanvas.jsx'
import { usePageSeo } from '../utils/seo.js'
import { useI18n } from '../i18n/index.jsx'

export default function Layout() {
  const { license, deactivate } = useLicense()
  const { t } = useI18n()
  const navigate = useNavigate()
  const tabs = useTabs()
  usePageSeo({ title: '工作台 · 幕后 文字剧场', noindex: true })

  const [showUser, setShowUser] = useState(false)
  const [showWallpaper, setShowWallpaper] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [showTabMenu, setShowTabMenu] = useState(false)
  // 壁纸 —— 从 localStorage 读初始值，订阅 storage 事件 + 4s 轮询跨组件同步
  const [wallpaperId, setWallpaperId] = useState(() => localStorage.getItem('scriptforge_wallpaper'))
  useEffect(() => {
    const handler = (e) => { if (e.key === 'scriptforge_wallpaper') setWallpaperId(e.newValue) }
    window.addEventListener('storage', handler)
    const poll = setInterval(() => setWallpaperId(localStorage.getItem('scriptforge_wallpaper')), 4000)
    return () => { window.removeEventListener('storage', handler); clearInterval(poll) }
  }, [])

  const mainRef = useRef(null)
  const scrollTargetRef = useRef(null)
  const lastPointerRef = useRef(null)
  // 天气自动切换（雨 / 落叶 / 雾）
  const weatherMode = useAutoWeather()
  // 幕布开幕动画：只在首次启动触发一次（v2 key → 让 1.5.10 重放）
  const [curtainOpen, setCurtainOpen] = useState(() => !!localStorage.getItem('scriptforge_curtain_opened_v2'))
  useEffect(() => {
    if (!curtainOpen) {
      requestAnimationFrame(() => {
        setCurtainOpen(true)
        localStorage.setItem('scriptforge_curtain_opened_v2', '1')
      })
    }
  }, [])
  // 键盘滚动动画状态：累积位移 + 每帧 lerp，按键连发时不会反复重启动画
  const scrollAnimRef = useRef({ el: null, raf: 0, dx: 0, dy: 0 })

  // 工作台隐藏滚动条：左键点选区块后，方向键 / PageUp、PageDown 平移该区块
  useEffect(() => {
    const anim = scrollAnimRef.current

    const stopAnim = () => {
      if (anim.raf) cancelAnimationFrame(anim.raf)
      anim.raf = 0
      anim.dx = 0
      anim.dy = 0
    }

    const tick = () => {
      anim.raf = 0
      const el = anim.el
      if (!el || !el.isConnected) { anim.dx = 0; anim.dy = 0; return }
      const K = 0.26 // 每帧吃掉剩余位移的比例，越小越绵
      const sx = anim.dx * K
      const sy = anim.dy * K
      anim.dx -= sx
      anim.dy -= sy
      el.scrollBy(sx, sy)
      if (Math.abs(anim.dx) > 0.5 || Math.abs(anim.dy) > 0.5) {
        anim.raf = requestAnimationFrame(tick)
      } else {
        anim.dx = 0
        anim.dy = 0
      }
    }

    const glideScroll = (el, dx, dy) => {
      if (anim.el !== el) {
        stopAnim()
        anim.el = el
      }
      // 累积并限幅，长按后松手不会滑出太远
      anim.dx = Math.max(-1200, Math.min(1200, anim.dx + dx))
      anim.dy = Math.max(-1600, Math.min(1600, anim.dy + dy))
      if (!anim.raf) anim.raf = requestAnimationFrame(tick)
    }

    const isScrollable = (el) => {
      if (!el || el.nodeType !== 1) return false
      const style = getComputedStyle(el)
      const oy = /auto|scroll/.test(style.overflowY)
      const ox = /auto|scroll/.test(style.overflowX)
      if (!oy && !ox) return false
      return (oy && el.scrollHeight - el.clientHeight > 8)
        || (ox && el.scrollWidth - el.clientWidth > 8)
    }

    // 从点击目标向上找最近的可滚动容器（弹窗、项目栏、时间线、纸面都适用）
    const findScroller = (node) => {
      let el = node
      while (el && el !== document.body && el !== document.documentElement) {
        if (isScrollable(el)) return el
        el = el.parentElement
      }
      return null
    }

    const onPointerDown = (e) => {
      lastPointerRef.current = e.target
      const tag = e.target?.tagName
      // 输入框 / 正文编辑区保持原生光标行为
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return
      scrollTargetRef.current = findScroller(e.target)
      // 手动接管滚动时立刻停掉正在进行的键盘惯性
      stopAnim()
    }

    // 滚轮 / 触控板介入时让位给原生滚动
    const onWheel = () => stopAnim()
    const onTouchStart = () => stopAnim()

    // 没有点选过时：先用最后点击位置，再用焦点，最后用当前可见的最大滚动容器
    const pickFallback = () => {
      const fromPointer = findScroller(lastPointerRef.current)
      if (fromPointer) return fromPointer
      const fromFocus = findScroller(document.activeElement)
      if (fromFocus) return fromFocus
      let best = null
      let bestRange = 24
      for (const el of document.querySelectorAll('div,section,article,ul,main,aside')) {
        if (!isScrollable(el)) continue
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) continue
        const range = Math.max(el.scrollHeight - el.clientHeight, el.scrollWidth - el.clientWidth)
        if (range > bestRange) { best = el; bestRange = range }
      }
      return best
    }

    const onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const el = e.target
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      const step = e.shiftKey ? 320 : 96
      const map = {
        ArrowUp: [0, -step], ArrowDown: [0, step],
        ArrowLeft: [-step, 0], ArrowRight: [step, 0],
        PageUp: [0, -step * 3], PageDown: [0, step * 3],
      }
      const delta = map[e.key]
      if (!delta) return
      let target = scrollTargetRef.current
      if (!target || !target.isConnected || !isScrollable(target)) {
        target = pickFallback()
        scrollTargetRef.current = target
      }
      if (!target) return
      e.preventDefault()
      glideScroll(target, delta[0], delta[1])
    }

    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    return () => {
      stopAnim()
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
    }
  }, [])

  // 切标签后重新判定滚动目标
  useEffect(() => { scrollTargetRef.current = null }, [tabs.activeId])

  useEffect(() => { setWallpaperId(loadWallpaper()) }, [])

  // 编辑器里的「剧作风格」徽章 → 切到风格库标签
  useEffect(() => {
    const handler = () => tabs.switchTo('style')
    window.addEventListener('scriptforge:open-style', handler)
    return () => window.removeEventListener('scriptforge:open-style', handler)
  }, [tabs.switchTo])

  const currentArt = wallpaperId ? getArtById(wallpaperId) : null

  const handleWallpaperSelect = (id) => {
    // id=null → 关闭壁纸（清掉 localStorage，回到默认黑底）
    saveWallpaper(id)
    setWallpaperId(id)
    setShowWallpaper(false)
  }

  const handleLogout = () => { deactivate(); navigate('/license') }

  const planBadge = () => {
    const open = () => setShowUpgrade(true)
    if (!license) {
      return (
        <button onClick={open} className="px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] text-ivory-300 bg-noir-800 border border-noir-600 hover:border-gold-500 hover:text-gold-400 transition-colors cursor-pointer">
          {t('未激活 · 升级 →')}
        </button>
      )
    }
    const p = license.plan
    const cls = 'px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] border cursor-pointer hover:scale-[1.03] transition-transform'
    if (p === 'test')     return <button onClick={open} className={`${cls} bg-cyan-500/10 border-cyan-400/50 text-cyan-300`}>🧪 测试版</button>
    if (p === 'lifetime') return <button onClick={open} className={`${cls} bg-gold-500/10 border-gold-500/40 text-gold-400`}>{t('👑 终身版')}</button>
    if (p === 'pro')     return <button onClick={open} className={`${cls} bg-violet-500/10 border-violet-400/40 text-violet-300`}>★ Pro</button>
    if (p === 'trial')   return <button onClick={open} className={`${cls} bg-green-500/10 border-green-500/40 text-green-400`}>{t('⏱ 试用版 · 升级')}</button>
    return <button onClick={open} className={`${cls} bg-noir-800 border-noir-600 text-ivory-400 hover:border-gold-500 hover:text-gold-400`}>{t('Free · 升级 →')}</button>
  }

  // 根据 activeTab 类型渲染组件
  const renderActiveContent = () => {
    if (!tabs.activeTab) return null
    switch (tabs.activeTab.type) {
      case 'timeline':   return <Timeline onOpenEditor={() => tabs.switchTo('editor')} />
      case 'storyboard': return <StoryboardEditor />
      case 'shelf':      return <ScriptShelf onOpenScript={() => tabs.switchTo('editor')} />
      case 'style':      return <StyleLibrary />
      default:           return <ScriptEditor />
    }
  }

  // ============== Tab 条组件 ==============
  const TabBar = ({ compact = false }) => (
    <div className={`relative ${compact ? '' : 'z-10 bg-noir-900/90'}`}>
      <div className={`w-full px-1 flex items-stretch ${compact ? 'h-8' : 'h-10'}`}>
        {/* Tab 列表 */}
        <div className="flex items-stretch flex-1 overflow-x-auto scroll-noir min-w-0">
          {tabs.tabs.map(tab => {
            const meta = getTypeMeta(tab.type)
            const active = tab.id === tabs.activeId
            return (
              <div
                key={tab.id}
                onClick={() => tabs.setActiveId(tab.id)}
                className={`group flex items-center gap-2 px-4 h-full cursor-pointer transition-colors duration-300 min-w-0 max-w-[220px] ${
                  compact
                    ? active ? 'bg-white/10 text-gold-500 border-b-2 border-b-gold-500/80'
                            : 'text-ivory-300 hover:text-ivory-100 hover:bg-white/8'
                    : active ? 'bg-noir-800 text-gold-500 border-r border-noir-700 border-b-2 border-b-gold-500'
                             : 'text-ivory-300 hover:text-ivory-100 hover:bg-noir-800/50 border-r border-noir-700'
                }`}
              >
                <meta.icon size={14} className="flex-shrink-0" />
                <span className="text-[11px] uppercase tracking-[0.1em] truncate">{t(meta.label)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); tabs.closeTab(tab.id) }}
                  className={`ml-1 w-4 h-4 flex items-center justify-center flex-shrink-0 transition-all ${
                    active ? 'opacity-60 hover:opacity-100 hover:text-red-400' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-red-400'
                  }`}
                  title={t('关闭')}
                >
                  <X size={10} />
                </button>
              </div>
            )
          })}
        </div>

        {/* 右侧操作：+ 新建 Tab 菜单 */}
        <div className={`flex items-center ${compact ? '' : 'border-l border-noir-700'}`}>
          <div className="relative">
            <button
              onClick={() => setShowTabMenu(!showTabMenu)}
              className={`${compact ? 'w-8' : 'w-10'} h-full flex items-center justify-center text-ivory-400 hover:text-gold-500 transition-colors ${compact ? 'hover:bg-white/8' : 'hover:bg-noir-800'}`}
              title={t('新建标签页')}
            >
              <Plus size={16} />
            </button>
            {showTabMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowTabMenu(false)} />
                <div className="absolute top-full right-0 mt-1 w-48 menu-noir z-50 animate-fade-in">
                  <div className="px-4 py-2 text-[9px] uppercase tracking-[0.3em] text-gold-500 border-b border-noir-700">
                    {t('New Tab · 新建')}
                  </div>
                  {[
                    { type: 'editor',     label: '剧本编辑器',   icon: FileText },
                    { type: 'style',      label: '剧作风格库',   icon: Layers },
                    { type: 'timeline',   label: '剧本叙事线',   icon: Clapperboard },
                    { type: 'storyboard', label: '分镜编辑器',   icon: Film },
                    { type: 'shelf',      label: '剧本架',       icon: BookOpen },
                  ].map(item => (
                    <button
                      key={item.type}
                      onClick={() => { tabs.addTab(item.type); setShowTabMenu(false) }}
                      className="w-full text-left px-4 py-2.5 text-xs text-ivory-200 hover:bg-noir-700 hover:text-gold-500 transition-colors flex items-center gap-3 border-b border-noir-700/50 last:border-0"
                    >
                      <item.icon size={14} /> {t(item.label)}
                    </button>
                  ))}
                  <div className="border-t border-noir-700 mt-1">
                    <button
                      onClick={() => { tabs.closeOthers(tabs.activeId); setShowTabMenu(false) }}
                      className="w-full text-left px-4 py-2 text-[10px] uppercase tracking-[0.15em] text-ivory-400 hover:text-ivory-100 hover:bg-noir-700 transition-colors"
                    >
                      {t('关闭其他标签')}
                    </button>
                    <button
                      onClick={() => { tabs.closeAll(); setShowTabMenu(false) }}
                      className="w-full text-left px-4 py-2 text-[10px] uppercase tracking-[0.15em] text-ivory-400 hover:text-red-400 hover:bg-noir-700 transition-colors"
                    >
                      {t('关闭全部')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="noir-surface workbench h-screen flex flex-col overflow-hidden">

      {/* ============ 壁纸层：整个工作台唯一的底 ============ */}
      {currentArt && (
        <div
          className="art-wallpaper-layer"
          style={{
            backgroundImage: `url(${currentArt.url})`,
            backgroundPosition: `center ${currentArt.focusY ?? 50}%`,
            opacity: 1,
          }}
        />
      )}
      {currentArt && (
        <div className="art-meta">
          {currentArt.title} · {currentArt.artist} ({currentArt.year}) · {currentArt.style}
        </div>
      )}

      {/* ============ 幕布顶栏：合并 TitleBar + header ============ */}
      <div
        className="curtain-topbar relative z-10"
        data-weather={weatherMode}
      >
        {/* 聚光锥 */}
        <div className="curtain-spotlight" />
        {/* 天气层 */}
        <div className="curtain-weather-layer">
          <WeatherCanvas mode={weatherMode} />
          {weatherMode === 'fog' && (
            <div className="curtain-fog"><span /><span /><span /><span /><span /></div>
          )}
        </div>
        {/* 第一层：菜单 + 三键 */}
        <div className="curtain-row curtain-row-top app-drag">
          <TitleBar onSwitch={tabs.switchTo} bare />
        </div>
        {/* 第二层：品牌 + 快捷面板按钮 + Tab + 右按钮 */}
        <div className="curtain-row curtain-row-bottom">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <NavLink to="/home" className="flex items-center gap-3 group flex-shrink-0 pl-4">
              <span className="brand-glow headline-display text-xl text-ivory-100 tracking-tighter group-hover:text-gold-500 transition-colors">幕后</span>
              <span className="hidden sm:inline text-[9px] uppercase tracking-[0.3em] text-gold-500 border-l border-gold-500/30 pl-3">{t('文字剧场')}</span>
            </NavLink>

            {/* 快捷面板切换按钮（之前合并时丢了） */}
            <nav className="hidden md:flex items-center gap-0.5 pl-2 border-l border-white/8">
              {[
                { type: 'editor',     label: '剧本',   icon: FileText },
                { type: 'style',      label: '风格库',   icon: Layers },
                { type: 'timeline',   label: '叙事线', icon: Clapperboard },
                { type: 'storyboard', label: '分镜',   icon: Film },
                { type: 'shelf',      label: '剧本架',   icon: BookOpen, pro: true },
              ].map(item => {
                const currentType = tabs.activeTab?.type
                const isActive = currentType === item.type
                return (
                  <button
                    key={item.type}
                    onClick={() => tabs.switchTo(item.type)}
                    className={`relative px-3 py-1 text-[10px] uppercase tracking-[0.15em] transition-colors duration-500 flex items-center gap-1.5 h-full ${
                      isActive ? 'text-gold-500' : 'text-ivory-300 hover:text-gold-500'
                    }`}
                  >
                    <item.icon size={12} />
                    {t(item.label)}
                    {item.pro && license && license.plan !== 'pro' && license.plan !== 'lifetime' && license.plan !== 'test' && (
                      <span className="text-[7px] tracking-[0.1em] text-gold-500/60 ml-0.5">Pro</span>
                    )}
                    {isActive && (
                      <span className="absolute bottom-0 left-15% right-15% h-[1px] bg-gold-500 animate-slow-pulse" />
                    )}
                  </button>
                )
              })}
            </nav>

            <div className="flex-1 min-w-0"><TabBar compact /></div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 pr-3">
            {planBadge()}
            <button onClick={() => setShowWallpaper(true)}
              className={`w-8 h-8 flex items-center justify-center border transition-all duration-500 ${
                currentArt ? 'border-gold-500/60 text-gold-500 bg-gold-500/10'
                           : 'border-noir-600 text-ivory-300 hover:text-gold-500 hover:border-gold-500/50'
              }`}>
              <Palette size={14} />
            </button>
            <button onClick={() => setShowSettings(true)}
              className="w-8 h-8 flex items-center justify-center border border-noir-600 text-ivory-300 hover:text-gold-500 hover:border-gold-500/50 transition-all duration-500">
              <SettingsIcon size={14} />
            </button>
            <div className="relative">
              <button onClick={() => setShowUser(!showUser)}
                className="w-8 h-8 flex items-center justify-center border border-noir-600 text-ivory-300 hover:text-gold-500 hover:border-gold-500/50 transition-all duration-500">
                <User size={14} />
              </button>
              {showUser && (
                <div className="absolute right-0 top-full mt-2 w-56 menu-noir animate-fade-in" onMouseLeave={() => setShowUser(false)}>
                  <div className="p-4 border-b border-noir-700">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-ivory-400 mb-1">{t('当前版本')}</div>
                    <div className="headline text-lg text-gold-500">
                      {license?.plan === 'test' ? '🧪 测试版'
                       : license?.plan === 'lifetime' ? t('终身版')
                       : license?.plan === 'pro' ? t('Pro 版')
                       : license?.plan === 'trial' ? t('试用版')
                       : license?.plan === 'free' ? t('免费版') : t('未激活')}
                    </div>
                  </div>
                  <div className="py-1">
                    <button onClick={() => { setShowUser(false); setShowSettings(true) }}
                      className="w-full text-left px-4 py-2 text-xs uppercase tracking-[0.15em] text-ivory-300 hover:bg-noir-700 hover:text-gold-500 transition-colors">
                      {t('设置')}
                    </button>
                    <button onClick={() => { setShowUser(false); navigate('/admin') }}
                      className="w-full text-left px-4 py-2 text-xs uppercase tracking-[0.15em] text-ivory-300 hover:bg-noir-700 hover:text-gold-500 transition-colors">
                      {t('管理后台')}
                    </button>
                    <button onClick={() => { setShowUser(false); handleLogout() }}
                      className="w-full text-left px-4 py-2 text-xs uppercase tracking-[0.15em] text-red-400 hover:bg-noir-700 transition-colors">
                      {t('退出激活')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* 开幕动画 */}
        <div className={`curtain-curtain curtain-curtain-left ${curtainOpen ? 'is-open' : ''}`} />
        <div className={`curtain-curtain curtain-curtain-right ${curtainOpen ? 'is-open' : ''}`} />
      </div>

      {/* ============ 主内容 ============ */}
      <main ref={mainRef} className="flex-1 min-h-0 relative z-0 overflow-y-auto">
        {renderActiveContent()}
      </main>

      {/* ============ 移动端底部导航 ============ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-noir-900/95">
        <div className="flex">
          {[
            { type: 'editor',     label: '剧本',   icon: FileText },
            { type: 'style',      label: '风格库',   icon: Layers },
            { type: 'timeline',   label: '叙事线', icon: Clapperboard },
            { type: 'storyboard', label: '分镜',   icon: Film },
            { type: 'shelf',      label: '剧本架',   icon: BookOpen },
          ].map(item => {
            const isActive = tabs.activeTab?.type === item.type
            return (
              <button
                key={item.type}
                onClick={() => tabs.switchTo(item.type)}
                className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
                  isActive ? 'text-gold-500' : 'text-ivory-400'
                }`}
              >
                <item.icon size={18} />
                <span className="text-[10px] uppercase tracking-[0.15em]">{t(item.label)}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* ============ 壁纸选择器 ============ */}
      {showWallpaper && (
        <WallpaperPicker currentId={wallpaperId} onSelect={handleWallpaperSelect} onClose={() => setShowWallpaper(false)} />
      )}

      {/* ============ 偏好设置（语言） ============ */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

      {/* ============ 升级弹窗 ============ */}
      {showUpgrade && (
        <UpgradeModal
          currentPlan={license?.plan}
          onClose={() => setShowUpgrade(false)}
          onChoosePlan={(plan) => {
            setSelectedPlan(plan)
            setShowCheckout(true)
          }}
        />
      )}

      {/* ============ 支付弹窗 ============ */}
      {showCheckout && (
        <CheckoutModal
          plan={selectedPlan}
          onClose={() => { setShowCheckout(false); setSelectedPlan(null) }}
          onBack={() => { setShowCheckout(false) }}
        />
      )}
    </div>
  )
}
