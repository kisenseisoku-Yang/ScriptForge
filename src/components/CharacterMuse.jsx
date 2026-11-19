import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Maximize2, Minimize2, MessageCircle, X } from 'lucide-react'
import MuseAvatar from './muse/MuseAvatar.jsx'
import MusePanel from './muse/MusePanel.jsx'
import { museSay, greetingByHour, reactToProgress } from '../utils/museDialogue.js'
import { computeStats } from '../utils/scriptAudit.js'

const POS_KEY = 'scriptforge_muse_pos'
const MODE_KEY = 'scriptforge_muse_mode'
const VISIBLE_KEY = 'scriptforge_muse_visible'

export default function CharacterMuse({ text = '', visible: visibleProp, onVisibleChange }) {
  const [visibleInternal, setVisibleInternal] = useState(() => {
    try { return localStorage.getItem(VISIBLE_KEY) !== '0' } catch { return true }
  })
  const controlled = typeof visibleProp === 'boolean'
  const visible = controlled ? visibleProp : visibleInternal
  const setVisible = (v) => {
    const nv = typeof v === 'function' ? v(visible) : v
    if (controlled) {
      try { localStorage.setItem(VISIBLE_KEY, nv ? '1' : '0') } catch {}
      onVisibleChange?.(nv)
    } else {
      setVisibleInternal(nv)
    }
  }
  const [panelOpen, setPanelOpen] = useState(false)
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem(MODE_KEY) || 'bust' } catch { return 'bust' }
  })
  const [expression, setExpression] = useState('normal')
  const [talking, setTalking] = useState(false)
  const [bubble, setBubble] = useState('')
  const [focusing, setFocusing] = useState(false)
  const [pos, setPos] = useState(() => {
    try {
      const v = localStorage.getItem(POS_KEY)
      if (v) return JSON.parse(v)
    } catch {}
    return { x: Math.max(20, window.innerWidth - 220), y: window.innerHeight - 26 }
  })

  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, originX: 0, originY: 0, moved: false })
  const bubbleTimer = useRef(null)
  const expressionTimer = useRef(null)
  const idleTimer = useRef(null)
  const lastInteraction = useRef(Date.now())

  // 原画素材宽高比：半身 202/292，全身 296/1000
  const avatarWidth = mode === 'full' ? 118 : 172
  const avatarHeight = mode === 'full'
    ? Math.round(avatarWidth * 1000 / 296)
    : Math.round(avatarWidth * 292 / 202)

  // ---------- 说话 ----------
  const speak = useCallback((line, duration = 4200) => {
    if (!line) return
    setBubble(line)
    setTalking(true)
    clearTimeout(bubbleTimer.current)
    bubbleTimer.current = setTimeout(() => {
      setBubble('')
      setTalking(false)
      setExpression('normal')
    }, duration)
  }, [])

  // ---------- 初始问候 ----------
  useEffect(() => {
    const t = setTimeout(() => speak(greetingByHour(), 5200), 900)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- 情绪 / 视角随机变化 ----------
  useEffect(() => {
    const cycle = () => {
      if (talking) return
      const pool = ['smile', 'thinking', 'normal', 'surprised']
      const next = pool[Math.floor(Math.random() * pool.length)]
      setExpression(next)
      clearTimeout(expressionTimer.current)
      expressionTimer.current = setTimeout(() => {
        if (!talking) setExpression('normal')
      }, 2600)
    }
    const iv = setInterval(cycle, 9000 + Math.random() * 4000)
    return () => { clearInterval(iv); clearTimeout(expressionTimer.current) }
  }, [talking])

  // ---------- 闲置时偶尔搭话 ----------
  useEffect(() => {
    if (!visible) return
    const iv = setInterval(() => {
      if (panelOpen || talking) return
      if (Date.now() - lastInteraction.current < 100000) return
      const st = computeStats(text)
      if (st.chars < 200) speak(museSay(Math.random() < 0.5 ? 'tooLittle' : 'life'))
      else speak(museSay(Math.random() < 0.35 ? 'life' : 'idle'))
    }, 110000)
    return () => clearInterval(iv)
  }, [visible, panelOpen, talking, text, speak])

  // ---------- 快捷键 ----------
  useEffect(() => {
    const onKey = (e) => {
      const target = e.target
      const tag = target?.tagName?.toLowerCase()
      const editable = tag === 'input' || tag === 'textarea' || target?.isContentEditable
      if (e.key === 'Escape') {
        if (panelOpen) { setPanelOpen(false); return }
      }
      const isH = e.key === 'h' || e.key === 'H'
      if (!isH) return
      if (e.altKey) {
        e.preventDefault()
        setVisible(v => !v)
        return
      }
      // 仅在非输入状态下，单按 H 才触发（避免打字误触）
      if (!editable && !e.ctrlKey && !e.metaKey) {
        setVisible(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelOpen])

  // ---------- 持久化 ----------
  useEffect(() => {
    try { localStorage.setItem(POS_KEY, JSON.stringify(pos)) } catch {}
  }, [pos])
  useEffect(() => {
    try { localStorage.setItem(MODE_KEY, mode) } catch {}
  }, [mode])
  useEffect(() => {
    try { localStorage.setItem(VISIBLE_KEY, visible ? '1' : '0') } catch {}
  }, [visible])

  // ---------- 窗口尺寸变化时夹回来 ----------
  useEffect(() => {
    const half = avatarWidth / 2
    const clamp = (p) => ({
      x: Math.min(Math.max(p.x, half + 4), window.innerWidth - half - 4),
      y: Math.min(Math.max(p.y, 40), window.innerHeight - 8),
    })
    const onResize = () => setPos(clamp)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [avatarWidth])

  // ---------- 拖拽 ----------
  const onMouseDown = (e) => {
    if (e.button !== 0) return
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
      moved: false,
    }
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current
      if (!d.dragging) return
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true
      const half = avatarWidth / 2
      setPos({
        x: Math.min(Math.max(half + 4, d.originX + dx), window.innerWidth - half - 4),
        y: Math.min(Math.max(40, d.originY + dy), window.innerHeight - 8),
      })
    }
    const onUp = () => {
      const d = dragRef.current
      if (!d.dragging) return
      d.dragging = false
      // 没拖动 → 当作点击
      if (!d.moved) {
        lastInteraction.current = Date.now()
        setPanelOpen(v => !v)
        if (!panelOpen) speak(museSay('click'), 2600)
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [panelOpen, speak, avatarWidth])

  if (!visible) {
    // 收起来时留一个极小入口
    return (
      <button
        onClick={() => setVisible(true)}
        className="muse-hint"
        title="呼出斧头（H）"
      >
        <span />
      </button>
    )
  }

  const panelOnRight = pos.x < 420

  return (
    <div
      className="muse-root"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* 面板 */}
      {panelOpen && (
        <div
          className="muse-panel-wrap"
          style={panelOnRight
            ? { left: avatarWidth + 14, bottom: 0 }
            : { right: avatarWidth + 14, bottom: 0 }}
        >
          <MusePanel
            text={text}
            onClose={() => setPanelOpen(false)}
            mode={mode}
            setMode={setMode}
            onSpeak={speak}
            setExpression={setExpression}
            onStartFocus={setFocusing}
          />
        </div>
      )}

      {/* 气泡 */}
      {bubble && (
        <div
          className="muse-bubble"
          style={{ bottom: avatarHeight + 12, ...(panelOnRight ? { left: 0 } : { right: 0 }) }}
        >
          <div className="muse-bubble-inner">{bubble}</div>
          <div className="muse-bubble-tail" />
        </div>
      )}

      {/* 角色 */}
      <div
        className={`muse-avatar-wrap ${dragRef.current.dragging ? 'dragging' : ''}`}
        onMouseDown={onMouseDown}
        onMouseEnter={() => { lastInteraction.current = Date.now() }}
        title="拖动我 / 点我打开面板"
      >
        <MuseAvatar
          expression={expression}
          mode={mode}
          talking={talking}
          focusing={focusing}
          width={avatarWidth}
        />
      </div>

      {/* 小工具条 */}
      <div
        className="muse-tools"
        style={{ bottom: avatarHeight + 6, left: '50%' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => { e.stopPropagation(); setMode(m => m === 'bust' ? 'full' : 'bust') }}
          title={mode === 'bust' ? '切换全身' : '切换半身'}
        >
          {mode === 'bust' ? <Maximize2 size={11} /> : <Minimize2 size={11} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setPanelOpen(v => !v) }}
          title="打开面板"
        >
          <MessageCircle size={11} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setVisible(false) }}
          title="收起（H 键呼出）"
        >
          <X size={11} />
        </button>
      </div>
    </div>
  )
}
