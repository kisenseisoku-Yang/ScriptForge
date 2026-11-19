﻿﻿import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Clapperboard, Undo2, Redo2, Copy, Archive, RotateCcw, ArrowUp, ArrowDown,
  ExternalLink, ZoomIn, ZoomOut, Save, AlertCircle, Film, Layers, ChevronRight, X
} from 'lucide-react'
import { getScript, updateScript, loadShelf } from '../utils/scriptShelf.js'
import { getPresetById } from '../config/formatPresets.js'
import { parseScriptText, serializeScript, ELEMENT_TYPES } from '../utils/scriptParser.js'
import {
  parseScenes, buildScriptText, loadTimelineMeta, saveTimelineMeta, storySortValue, sceneKey
} from '../utils/timelineModel.js'
import { getArtById } from '../utils/artLibrary.js'
import { useI18n } from '../i18n/index.jsx'

const FUNCTION_OPTIONS = ['铺垫', '推进', '转折', '揭示', '高潮', '过场']
const ACT_OPTIONS = ['第一幕', '第二幕', '第三幕']
const STATUS_OPTIONS = ['草稿', '修改中', '定稿']
const STORYLINE_OPTIONS = ['主线', 'A故事', 'B故事', 'C故事', '副线', '支线']
const DEFAULT_TRACKS = ['主线', 'A故事', 'B故事', 'C故事']
const EMPTY_META = {
  storyTime: '', storyline: '主线', tone: '', function: '',
  synopsis: '', act: '', status: '草稿',
  // 场景结构（剧作法）
  objective: '', conflict: '', obstacle: '', turningPoint: '', emotionalChange: '', outcome: '',
}

// 一场戏 → 分镜小框：动作段落各成一框，角色 + 台词合成一框
export function buildSceneFrames(scene) {
  const frames = []
  let current = null
  const push = (frame) => { frames.push({ id: frames.length, ...frame }); return frames[frames.length - 1] }

  for (const el of (scene?.elements || []).slice(1)) {
    if (el.type === 'character') {
      current = push({ kind: 'dialogue', speaker: String(el.text || '').replace(/^【|】$/g, ''), lines: [] })
    } else if (el.type === 'dialogue' || el.type === 'parenthetical') {
      if (current) current.lines.push(el.text)
      else current = push({ kind: 'dialogue', speaker: '', lines: [el.text] })
    } else {
      current = null
      const text = String(el.text || '').trim()
      if (!text) continue
      push({ kind: el.type === 'shot' ? 'shot' : el.type === 'transition' ? 'transition' : 'action', text })
    }
  }
  return frames.map(f => ({ ...f, summary: f.lines?.join(' ') || f.text || '' }))
}

export default function Timeline({ onOpenEditor }) {
  const { t } = useI18n()
  const [script, setScript] = useState(null)
  const [loading, setLoading] = useState(true)
  // 壁纸：时间线板块做成半透明黑幕，让壁纸透上来
  const [wallpaperId, setWallpaperId] = useState(() => localStorage.getItem('scriptforge_wallpaper'))
  useEffect(() => {
    const timer = setInterval(() => {
      setWallpaperId(localStorage.getItem('scriptforge_wallpaper'))
    }, 4000)
    return () => clearInterval(timer)
  }, [])
  const wallpaperArt = wallpaperId ? getArtById(wallpaperId) : null
  const [front, setFront] = useState([])
  const [scenes, setScenes] = useState([])
  const [metaMap, setMetaMap] = useState({})
  const [archived, setArchived] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [mode, setMode] = useState('narrative')
  const [pxPerMin, setPxPerMin] = useState(56)
  // 轨道行高（Studio One 式纵向缩放）
  const [rowH, setRowH] = useState(78)
  const [tracks, setTracks] = useState(DEFAULT_TRACKS)
  const [saveState, setSaveState] = useState('idle')
  const [headingDraft, setHeadingDraft] = useState('')
  const [inspectorOpen, setInspectorOpen] = useState(false)

  // 剪辑式播放头：横坐标（px）、当前命中的场次、场次内进度 0–1
  const [playhead, setPlayhead] = useState(0)
  const [activeSceneId, setActiveSceneId] = useState(null)
  const [progress, setProgress] = useState(0)
  // 正在拖动的剧情卡：{ id, kind: 'move'|'trim', dx, lane, insertAt, w }
  const [cardDrag, setCardDrag] = useState(null)
  const dragRef = useRef(null)
  const zoomRef = useRef(pxPerMin)
  zoomRef.current = pxPerMin

  // 场景卡面（点卡片呼出）：直接编辑这一场的正文，自动同步回剧本
  // 用「第几场」而不是场景 id 定位——同步后正文重排，id 会变，索引不会
  const [cardSceneIndex, setCardSceneIndex] = useState(null)
  const [cardHeading, setCardHeading] = useState('')
  const [cardBody, setCardBody] = useState('')
  const cardTimerRef = useRef(null)
  const cardSyncRef = useRef(null)

  const stageRef = useRef(null)
  const innerRef = useRef(null)
  const nleRef = useRef(null)
  const draggingRef = useRef(false)
  const secPosRef = useRef({})     // 每场戏在整份剧本里的纵向位置
  const seekRef = useRef({ id: null, ratio: 0 })
  const selectedIdRef = useRef(null)
  const pastRef = useRef([])
  const futureRef = useRef([])
  const [, forceHistory] = useState(0)

  /* ---------------- 载入 ---------------- */
  useEffect(() => {
    let alive = true
    ;(async () => {
      let id = localStorage.getItem('scriptforge_active_script_id')
      let record = id ? await getScript(id) : null
      if (!record) {
        const shelf = await loadShelf()
        const first = shelf[0]
        if (first) {
          record = await getScript(first.id)
          if (record) localStorage.setItem('scriptforge_active_script_id', record.id)
        }
      }
      if (!alive) return
      if (!record) { setLoading(false); return }
      const doc = parseScenes(record.content, record.formatId)
      const meta = loadTimelineMeta(record.id)
      setScript(record)
      setFront(doc.front)
      setScenes(doc.scenes)
      setMetaMap(meta.scenes)
      setArchived(meta.archived)
      setTracks(meta.tracks?.length ? meta.tracks : DEFAULT_TRACKS)
      setSelectedId(doc.scenes[0]?.id || null)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  // 属性单独持久化（不进正文）
  useEffect(() => {
    if (script) saveTimelineMeta(script.id, { scenes: metaMap, archived, tracks })
  }, [script, metaMap, archived, tracks])

  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  /* ---------------- 写回正文 ---------------- */
  const persist = useCallback(async (nextScenes, nextFront = front, focusId = selectedIdRef.current) => {
    if (!script) return
    const content = buildScriptText(nextFront, nextScenes, script.formatId)
    setSaveState('saving')
    try {
      await updateScript(script.id, { content })
      setScript(prev => ({ ...prev, content }))
      // 正文已按模板重编场号，重新解析一次，保证时间线显示与正文完全一致
      const doc = parseScenes(content, script.formatId)
      const idx = nextScenes.findIndex(s => s.id === focusId)
      setFront(doc.front)
      setMetaMap(prev => {
        const nextMap = { ...prev }
        nextScenes.forEach((oldScene, i) => {
          const fresh = doc.scenes[i]
          if (!fresh || fresh.key === oldScene.key) return
          if (nextMap[oldScene.key] !== undefined) {
            nextMap[fresh.key] = nextMap[oldScene.key]
            delete nextMap[oldScene.key]
          }
        })
        return nextMap
      })
      setScenes(doc.scenes)
      setSelectedId(idx >= 0
        ? doc.scenes[Math.min(idx, doc.scenes.length - 1)]?.id || null
        : doc.scenes[0]?.id || null)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1400)
    } catch {
      setSaveState('error')
    }
  }, [script, front])

  const commit = useCallback((nextScenes, nextArchived = archived, focusId) => {
    pastRef.current = [...pastRef.current.slice(-29), { scenes, archived }]
    futureRef.current = []
    forceHistory(n => n + 1)
    setScenes(nextScenes)
    setArchived(nextArchived)
    persist(nextScenes, front, focusId)
  }, [scenes, archived, persist, front])

  const undo = () => {
    const snap = pastRef.current.pop()
    if (!snap) return
    futureRef.current.push({ scenes, archived })
    forceHistory(n => n + 1)
    setScenes(snap.scenes)
    setArchived(snap.archived)
    persist(snap.scenes)
  }

  const redo = () => {
    const snap = futureRef.current.pop()
    if (!snap) return
    pastRef.current.push({ scenes, archived })
    forceHistory(n => n + 1)
    setScenes(snap.scenes)
    setArchived(snap.archived)
    persist(snap.scenes)
  }

  // 快捷键：Ctrl/Cmd+Z 撤销，Ctrl/Cmd+Shift+Z / Ctrl+Y 重做
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return
      const key = String(e.key || '').toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo(); else undo()
      } else if (key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* ---------------- 场景操作 ---------------- */
  const selected = scenes.find(s => s.id === selectedId) || null
  const metaOf = (scene) => ({ ...EMPTY_META, ...(metaMap[scene?.key] || {}) })

  const updateSceneMeta = (key, patch) => {
    setMetaMap(prev => ({ ...prev, [key]: { ...EMPTY_META, ...(prev[key] || {}), ...patch } }))
  }

  const renameScene = (id, heading) => {
    const target = scenes.find(s => s.id === id)
    const value = String(heading || '').trim()
    if (!target || !value || value === target.heading) return
    // 标题变了要清掉旧 meta，让序列化时按新标题重新解析场景头
    const elements = [{ ...target.elements[0], text: value, meta: undefined }, ...target.elements.slice(1)]
    const nextKey = sceneKey(elements)
    if (nextKey !== target.key) {
      setMetaMap(prev => {
        if (!prev[target.key]) return prev
        const { [target.key]: moved, ...rest } = prev
        return { ...rest, [nextKey]: moved }
      })
    }
    commit(scenes.map(s => (s.id === id ? { ...s, heading: value, key: nextKey, elements } : s)))
  }

  /* ---------------- 场景卡面：点卡片 → 改这一场正文 ---------------- */
  const openSceneCard = (scene) => {
    if (!scene || !script) return
    setCardSceneIndex(scene.index)
    setCardHeading(scene.heading)
    setCardBody(serializeScript(scene.elements.slice(1), script.formatId).trim())
  }

  // 把卡面里的标题 + 正文解析回元素，写回这一场（停下打字 0.5 秒后同步）
  const applyCardDraft = (index, heading, body) => {
    if (index == null || !script) return
    const scene = scenes[index]
    if (!scene) return
    const head = String(heading || '').trim()
    if (!head) return
    const elements = parseScriptText(`${head}\n\n${body || ''}`, script.formatId)
    if (!elements.length || elements[0].type !== ELEMENT_TYPES.SLUGLINE) return
    // 内容没变就不重复写库
    const same = elements.length === scene.elements.length &&
      elements.every((el, i) => String(el.text || '') === String(scene.elements[i].text || '') && el.type === scene.elements[i].type)
    if (same) return
    const nextKey = sceneKey(elements)
    if (nextKey !== scene.key) {
      setMetaMap(prev => {
        if (!prev[scene.key]) return prev
        const { [scene.key]: moved, ...rest } = prev
        return { ...rest, [nextKey]: moved }
      })
    }
    commit(scenes.map((s, i) => (i === index ? { ...s, heading: head, key: nextKey, elements } : s)), archived, scene.id)
  }
  cardSyncRef.current = applyCardDraft

  // 停止输入 500ms 后同步；关闭卡面时立即同步
  const queueCardSync = (index, heading, body) => {
    clearTimeout(cardTimerRef.current)
    cardTimerRef.current = setTimeout(() => cardSyncRef.current?.(index, heading, body), 500)
  }

  const closeSceneCard = () => {
    clearTimeout(cardTimerRef.current)
    if (cardSceneIndex != null) cardSyncRef.current?.(cardSceneIndex, cardHeading, cardBody)
    setCardSceneIndex(null)
  }

  const reorder = (from, to) => {
    if (from === to) return
    const next = [...scenes]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    commit(next.map((s, i) => ({ ...s, index: i })))
  }

  const removeScene = (id) => {
    const target = scenes.find(s => s.id === id)
    if (!target) return
    const nextArchived = [...archived, {
      key: target.key,
      heading: target.heading,
      elements: target.elements,
      meta: metaMap[target.key] || {},
      at: Date.now(),
    }]
    const next = scenes.filter(s => s.id !== id).map((s, i) => ({ ...s, index: i }))
    const focus = next[Math.min(target.index, next.length - 1)]?.id || null
    commit(next, nextArchived, focus)
    setSelectedId(focus)
  }

  const duplicateScene = (id) => {
    const idx = scenes.findIndex(s => s.id === id)
    if (idx < 0) return
    const src = scenes[idx]
    const copy = {
      ...src,
      id: `${src.id}_copy${Date.now()}`,
      key: `${src.key}_copy${Date.now()}`,
      elements: src.elements.map((el, i) => ({ ...el, id: `${el.id}_c${i}` })),
    }
    const next = [...scenes]
    next.splice(idx + 1, 0, copy)
    if (metaMap[src.key]) {
      setMetaMap(prev => ({ ...prev, [copy.key]: { ...metaMap[src.key] } }))
    }
    commit(next.map((s, i) => ({ ...s, index: i })), archived, copy.id)
    setSelectedId(copy.id)
  }

  const restoreScene = (key) => {
    const entry = archived.find(a => a.key === key)
    if (!entry) return
    const restored = {
      id: `sc_r_${key}`,
      key,
      index: scenes.length,
      heading: entry.heading,
      intExt: '',
      location: '',
      timeOfDay: '',
      elements: entry.elements,
      characters: entry.elements.filter(e => e.type === 'character').map(e => e.text),
      body: entry.elements.filter(e => e.type !== 'slugline').map(e => e.text).join('\n'),
      duration: 1,
    }
    const nextArchived = archived.filter(a => a.key !== key)
    setMetaMap(prev => ({ ...prev, [key]: entry.meta || EMPTY_META }))
    commit([...scenes, restored], nextArchived, restored.id)
    setSelectedId(restored.id)
  }

  const moveScene = (id, dir) => {
    const idx = scenes.findIndex(s => s.id === id)
    const to = idx + dir
    if (idx < 0 || to < 0 || to >= scenes.length) return
    reorder(idx, to)
  }

  /* ---------------- 叙事轨（剪辑式） ---------------- */
  // 轨道 = 剧情线（storyline）；每场戏按预计时长换算成一张剧情卡片的宽度
  const cards = useMemo(() => {
    // 叙事顺序 / 故事时间：只改变卡片在时间线上的先后，不改正文
    const ordered = mode === 'chronological'
      ? scenes
        .map((scene, idx) => ({ scene, idx, sort: storySortValue(metaMap[scene.key]?.storyTime) }))
        .sort((a, b) => (a.sort ?? Number.MAX_SAFE_INTEGER) - (b.sort ?? Number.MAX_SAFE_INTEGER) || a.idx - b.idx)
        .map(item => item.scene)
      : scenes
    let x = 0
    return ordered.map((scene, i) => {
      const dur = Math.max(0.2, Number(metaMap[scene.key]?.duration) || scene.duration || 0.5)
      // 卡片宽度 = 固定标签宽度 + 时长；这样拖右边缘改时长时宽度会真实变化
      const w = Math.max(132, 96 + dur * pxPerMin)
      const card = {
        scene,
        i,
        x,
        w,
        dur,
        lane: metaMap[scene.key]?.storyline || '主线',
      }
      x += w + 8
      return card
    })
  }, [scenes, metaMap, pxPerMin, mode])

  const totalW = cards.length ? cards[cards.length - 1].x + cards[cards.length - 1].w : 0

  // 轨道名：主线 + A/B/C 四条默认轨，再加剧本里实际用到的剧情线（老项目只有三条也能补齐）
  const laneNames = useMemo(() => {
    const used = scenes.map(scene => metaMap[scene.key]?.storyline || '主线')
    return [...new Set([...DEFAULT_TRACKS, ...tracks, ...used])]
  }, [scenes, metaMap, tracks])

  const lanes = useMemo(() => laneNames.map(name => ({
    id: `track_${name}`,
    name,
    items: cards.filter(card => card.lane === name),
  })), [laneNames, cards])

  // 底部完整影片轨道：全部场景按叙事顺序铺开，宽度按时长分配
  const filmBlocks = useMemo(() => {
    let start = 0
    return cards.map(card => {
      const block = { ...card, start }
      start += card.dur
      return block
    })
  }, [cards])

  const activeScene = scenes.find(s => s.id === activeSceneId)
    || scenes.find(s => s.id === selectedId)
    || scenes[0] || null

  // 把指针进度换算成整份剧本里的纵向位置：这场戏开头 → 结尾
  const applyScroll = useCallback((sceneId, ratio) => {
    seekRef.current = { id: sceneId, ratio }
    const stage = stageRef.current
    const pos = secPosRef.current[sceneId]
    if (!stage || !pos) return
    const max = Math.max(0, stage.scrollHeight - stage.clientHeight)
    stage.scrollTop = Math.min(max, Math.max(0, pos.top + pos.height * ratio))
  }, [])

  // 量出每场戏在整份剧本中的位置；字体加载/排版变化后重新量，并按当前进度复位
  const measureSections = useCallback(() => {
    const stage = stageRef.current
    const inner = innerRef.current
    if (!stage || !inner) return
    const base = stage.getBoundingClientRect().top - stage.scrollTop
    const map = {}
    inner.querySelectorAll('[data-scene-id]').forEach(sec => {
      const rect = sec.getBoundingClientRect()
      map[sec.dataset.sceneId] = { top: rect.top - base, height: rect.height }
    })
    secPosRef.current = map
    const { id, ratio } = seekRef.current
    if (id) applyScroll(id, ratio)
  }, [applyScroll])

  useEffect(() => {
    if (loading) return
    const raf = requestAnimationFrame(measureSections)
    const inner = innerRef.current
    const observer = inner ? new ResizeObserver(measureSections) : null
    if (inner && observer) observer.observe(inner)
    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
    }
  }, [loading, scenes, activeSceneId, measureSections])

  // 播放头定位：命中哪张卡片、卡片内进度都由此决定，剧本跟着滚动
  const seekTo = useCallback((x) => {
    if (!cards.length) return
    const max = cards[cards.length - 1].x + cards[cards.length - 1].w
    const cx = Math.max(0, Math.min(max, x))
    const card = cards.find(c => cx >= c.x && cx < c.x + c.w) || cards[cards.length - 1]
    const ratio = Math.max(0, Math.min(1, (cx - card.x) / card.w))
    setPlayhead(cx)
    setActiveSceneId(card.scene.id)
    setSelectedId(card.scene.id)
    setProgress(ratio)

    // 指针在这场戏里往前走多少，剧本就往上滚多少
    applyScroll(card.scene.id, ratio)

    // 指针接近视口边缘时自动横向跟随
    const scroll = nleRef.current
    if (scroll) {
      const left = scroll.scrollLeft
      const right = left + scroll.clientWidth
      if (cx > right - 120) scroll.scrollLeft = cx - scroll.clientWidth + 160
      else if (cx < left + 60) scroll.scrollLeft = Math.max(0, cx - 120)
    }
  }, [cards])

  const seekToCard = (card, ratio = 0) => seekTo(card.x + card.w * ratio)

  const onNlePointerDown = (e) => {
    // 只响应左键；右键留给剧情卡的卡面（右键不能顺手把播放头拖走）
    if (e.button !== 0) return
    draggingRef.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const rect = e.currentTarget.getBoundingClientRect()
    seekTo(e.clientX - rect.left)
  }

  const onNlePointerMove = (e) => {
    if (!draggingRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    seekTo(e.clientX - rect.left)
  }

  const onNlePointerUp = () => { draggingRef.current = false }

  /* ---------------- 剧情卡拖动（Studio One 式：移动排序 / 跨轨 / 拉边缘改时长） ---------------- */
  const beginCardDrag = (e, card, kind) => {
    if (e.button !== 0 || mode !== 'narrative') return
    e.stopPropagation()
    e.preventDefault()
    const canvas = nleRef.current?.querySelector('.tl-nle-canvas')
    if (!canvas) return

    dragRef.current = {
      card, kind,
      startX: e.clientX,
      startY: e.clientY,
      lane: card.lane,
      moved: false,
      dx: 0,
      w: card.w,
      dur: card.dur,
      insertAt: card.i,
    }
    setCardDrag({ id: card.scene.id, kind, dx: 0, lane: card.lane, insertAt: card.i, w: card.w, dur: card.dur })

    const onMove = (ev) => {
      const d = dragRef.current
      if (!d) return
      const dx = ev.clientX - d.startX
      if (Math.abs(dx) > 2 || Math.abs(ev.clientY - d.startY) > 2) d.moved = true

      if (d.kind === 'trim') {
        d.dx = dx
        d.dur = Math.max(0.1, Number((d.card.dur + dx / zoomRef.current).toFixed(1)))
        d.w = Math.max(132, 96 + d.dur * zoomRef.current)
        setCardDrag({ id: d.card.scene.id, kind, dx, lane: d.lane, insertAt: d.insertAt, w: d.w, dur: d.dur })
        return
      }

      // 纵向决定落到哪条轨道
      const row = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.tl-nle-row')
      d.lane = row?.dataset.lane || d.lane

      // 横向决定插入到第几张卡之后：按其它卡片的中心点比较
      const others = cards.filter(c => c.scene.id !== d.card.scene.id)
      const centerX = d.card.x + d.card.w / 2 + dx
      d.insertAt = others.filter(c => c.x + c.w / 2 < centerX).length

      setCardDrag({ id: d.card.scene.id, kind, dx, lane: d.lane, insertAt: d.insertAt, w: d.w, dur: d.dur })
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      const d = dragRef.current
      dragRef.current = null
      setCardDrag(null)
      if (!d) return
      // 没拖动就是单击：把播放头定位到这一场的开头
      if (!d.moved) {
        if (d.kind === 'move') seekToCard(d.card)
        return
      }

      if (d.kind === 'trim') {
        // 右边缘拖动 → 按位移改写这一场的预计时长（卡片有最小宽度，所以按时长增量算）
        const dur = Math.max(0.1, Number((d.dur || d.card.dur).toFixed(1)))
        if (Math.abs(dur - d.card.dur) > 0.01) {
          updateSceneMeta(d.card.scene.key, { duration: dur })
        }
        return
      }

      if (d.lane !== d.card.lane) {
        updateSceneMeta(d.card.scene.key, { storyline: d.lane })
      }

      // 横向移动 = 改叙事顺序
      const from = scenes.findIndex(s => s.id === d.card.scene.id)
      if (from < 0) return
      const others = cards.filter(c => c.scene.id !== d.card.scene.id)
      const insertAt = Math.max(0, Math.min(others.length, d.insertAt))
      const arr = scenes.slice()
      const [moved] = arr.splice(from, 1)
      arr.splice(insertAt, 0, moved)
      const changed = arr.some((s, i) => s.id !== scenes[i]?.id)
      if (changed) commit(arr, archived, d.card.scene.id)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })

    // 避免拖动时选中文字/触发画布定位
    window.getSelection?.()?.removeAllRanges?.()
  }

  // Ctrl/Cmd + 滚轮：横向缩放（以鼠标位置为锚点）；Shift + 滚轮：轨道行高
  useEffect(() => {
    const el = nleRef.current
    if (!el) return
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const rect = el.getBoundingClientRect()
        const anchorX = e.clientX - rect.left + el.scrollLeft
        const prev = zoomRef.current
        const next = Math.max(20, Math.min(200, Math.round(prev * Math.exp(-e.deltaY * 0.0018))))
        if (next === prev) return
        setPxPerMin(next)
        requestAnimationFrame(() => {
          el.scrollLeft = anchorX * (next / prev) - (e.clientX - rect.left)
        })
      } else if (e.shiftKey) {
        e.preventDefault()
        setRowH(h => Math.max(48, Math.min(110, h - Math.round(e.deltaY * 0.12))))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [loading, script])

  // 轨道配色（0-4 循环）
  const trackIndex = (name) => {
    const i = lanes.findIndex(lane => lane.name === name)
    return i < 0 ? 0 : i % 5
  }

  const totalMinutes = useMemo(
    () => scenes.reduce((sum, s, i) => sum + (Number(metaMap[s.key]?.duration) || s.duration || 0), 0),
    [scenes, metaMap]
  )

  // 首次载入 / 场次变化后，把播放头停到当前场次的开头
  useEffect(() => {
    if (!cards.length) return
    if (!activeSceneId || !cards.some(c => c.scene.id === activeSceneId)) {
      setActiveSceneId(cards[0].scene.id)
      setPlayhead(0)
      setProgress(0)
    }
  }, [cards, activeSceneId])


  // 选中场景变化时同步标题草稿
  useEffect(() => {
    const s = scenes.find(x => x.id === selectedId)
    setHeadingDraft(s ? s.heading : '')
  }, [selectedId, scenes])

  /* ---------------- 渲染 ---------------- */
  if (loading) {
    return <div className="h-full flex items-center justify-center text-ivory-500 text-sm">{t('正在载入叙事线…')}</div>
  }

  if (!script) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <Clapperboard size={40} className="text-gold-500/60" />
        <p className="text-ivory-500 text-sm">{t('还没有剧本，先在剧本编辑器里写一场，叙事线会自动生成。')}</p>
        <button className="btn-gold" onClick={onOpenEditor}>
          {t('去写剧本')}
        </button>
      </div>
    )
  }

  const format = getPresetById(script.formatId)

  const activeCard = cards.find(c => c.scene.id === activeScene?.id) || cards[0] || null
  const playheadPct = totalW > 0 ? (playhead / totalW) * 100 : 0

  // 拖动时的插入位置提示线（按其它卡片的位置算）
  let insertX = null
  if (cardDrag && cardDrag.kind === 'move' && cardDrag.insertAt != null) {
    const others = cards.filter(c => c.scene.id !== cardDrag.id)
    const at = Math.min(cardDrag.insertAt, others.length)
    insertX = at <= 0 ? 0 : others[at - 1].x + others[at - 1].w + 2
  }

  return (
    <div className="tl-root">
      {/* 顶部工具条 */}
      <div className="tl-bar">
        <Clapperboard size={16} className="text-gold-500" />
        <span className="tl-title">{t('剧本叙事线')}</span>
        <span className="tl-sub">{script.title || t('未命名剧本')} · {format.name}</span>

        <div className="tl-seg">
          <button
            className={mode === 'narrative' ? 'active' : ''}
            onClick={() => setMode('narrative')}
          >{t('叙事顺序')}</button>
          <button
            className={mode === 'chronological' ? 'active' : ''}
            onClick={() => setMode('chronological')}
          >{t('故事时间')}</button>
        </div>

        <div className="tl-actions">
          <button onClick={undo} disabled={!pastRef.current.length} title={t('撤销')}><Undo2 size={14} /></button>
          <button onClick={redo} disabled={!futureRef.current.length} title={t('重做')}><Redo2 size={14} /></button>
          <button onClick={() => setPxPerMin(v => Math.max(20, v - 8))} title={t('横向缩小（Ctrl+滚轮）')}><ZoomOut size={14} /></button>
          <button onClick={() => setPxPerMin(v => Math.min(200, v + 8))} title={t('横向放大（Ctrl+滚轮）')}><ZoomIn size={14} /></button>
          <span className="tl-zoomval" title={t('Ctrl+滚轮 横向缩放 · Shift+滚轮 轨道高度')}>{Math.round((pxPerMin / 56) * 100)}%</span>
          <button
            className={inspectorOpen ? 'on' : ''}
            onClick={() => setInspectorOpen(v => !v)}
            title={t('场景属性')}
          ><Layers size={14} /></button>
          <span className="tl-save">
            {saveState === 'saving' && t('保存中…')}
            {saveState === 'saved' && <><Save size={11} /> {t('已同步到剧本')}</>}
            {saveState === 'error' && <><AlertCircle size={11} /> {t('保存失败')}</>}
          </span>
        </div>
      </div>

      {/* 上半区：剧本页，随播放头在剧情卡内的位置滚动 */}
      <div className="tl-stage">
        <div className="tl-stage-head">
          <span className="tl-stage-no">SC {String((activeCard?.i ?? 0) + 1).padStart(2, '0')}</span>
          <span className="tl-stage-title">{activeScene?.heading || t('暂无场景')}</span>
          {activeScene && (
            <span className="tl-stage-meta">
              {t('{n} 人 · 约 {d} 分钟', { n: activeScene.characters.length, d: metaOf(activeScene).duration || activeScene.duration })}
            </span>
          )}
          <span className="tl-stage-progress">{Math.round(progress * 100)}%</span>
        </div>

        <div className="tl-stage-paper" ref={stageRef}>
          {scenes.length ? (
            <div className="tl-stage-inner" ref={innerRef}>
              {cards.map(card => (
                <section
                  key={card.scene.id}
                  data-scene-id={card.scene.id}
                  className={`tl-scene-block${card.scene.id === activeScene?.id ? ' active' : ''}`}
                >
                  {(card.scene.elements || [])
                    .filter(el => (el.text || '').trim())
                    .map((el, i) => (
                      <div key={el.id || i} className={`tl-stage-el ${el.type || 'action'}`}>
                        {el.text}
                      </div>
                    ))}
                </section>
              ))}
            </div>
          ) : (
            <p className="tl-empty">{t('还没有场景')}</p>
          )}
        </div>
      </div>

      {/* 下半区：叙事轨 + 可拖动播放头 */}
      <div className="tl-nle">
        <div className="tl-nle-heads">
          <div className="tl-nle-head tl-nle-head-ruler">{t('轨道')}</div>
          {lanes.map(lane => (
            <div
              key={lane.id}
              className="tl-nle-head"
              style={{ height: rowH }}
              title={t('{name} · {n} 场', { name: t(lane.name), n: lane.items.length })}
            >
              <span className={`tl-lane-dot c${trackIndex(lane.name)}`} />
              <span className="tl-nle-head-name">{t(lane.name)}</span>
              <span className="tl-nle-head-num">{lane.items.length}</span>
            </div>
          ))}
        </div>

        <div className="tl-nle-scroll scroll-noir" ref={nleRef}>
          <div
            className="tl-nle-canvas"
            style={{ width: Math.max(totalW, 1) }}
            onPointerDown={onNlePointerDown}
            onPointerMove={onNlePointerMove}
            onPointerUp={onNlePointerUp}
            onPointerCancel={onNlePointerUp}
          >
            <div className="tl-nle-ruler">
              {cards.map(card => (
                <span key={card.scene.id} className="tl-nle-tick" style={{ left: card.x }}>
                  SC {String(card.i + 1).padStart(2, '0')}
                </span>
              ))}
            </div>

            {lanes.map(lane => (
              <div
                key={lane.id}
                data-lane={lane.name}
                className={`tl-nle-row${cardDrag && cardDrag.lane === lane.name ? ' dragover' : ''}`}
                style={{ height: rowH }}
              >
                {lane.items.map(card => {
                  const dragging = cardDrag?.id === card.scene.id
                  const isTrim = dragging && cardDrag.kind === 'trim'
                  return (
                    <div
                      key={card.scene.id}
                      className={`tl-nle-card c${trackIndex(lane.name)}${card.scene.id === activeScene?.id ? ' active' : ''}${dragging ? ' dragging' : ''}`}
                      style={{
                        left: card.x,
                        width: isTrim ? cardDrag.w : card.w,
                        top: 7,
                        height: Math.max(34, rowH - 14),
                        transform: dragging && !isTrim ? `translateX(${cardDrag.dx}px)` : undefined,
                        zIndex: dragging ? 5 : undefined,
                      }}
                      title={t('{heading} · {dur}′　拖动改顺序 / 换轨道，拖右边缘改时长，右键改剧情', { heading: card.scene.heading, dur: card.dur })}
                      onPointerDown={e => beginCardDrag(e, card, 'move')}
                      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); openSceneCard(card.scene) }}
                    >
                      <span className="tl-nle-card-no">SC {String(card.i + 1).padStart(2, '0')}</span>
                      <span className="tl-nle-card-title">{card.scene.heading}</span>
                      <span className="tl-nle-card-foot">
                        {t('{dur}′ · {n} 人', { dur: (isTrim ? cardDrag.dur : card.dur).toFixed(1), n: card.scene.characters.length })}
                      </span>
                      <span
                        className="tl-nle-trim"
                        title={t('拖动调整预计时长')}
                        onPointerDown={e => beginCardDrag(e, card, 'trim')}
                      />
                    </div>
                  )
                })}
              </div>
            ))}

            {insertX != null && <div className="tl-nle-insert" style={{ left: insertX }} />}

            <div className="tl-nle-playhead" style={{ left: playhead }} />
          </div>
        </div>
      </div>

      {/* 最底部：全览条（位置不变） */}
      <div className="tl-overview">
        <div className="tl-overview-head">
          <span><Film size={11} /> {t('全览')}</span>
          <em>{t('{n} 场 · 约 {m} 分钟', { n: scenes.length, m: totalMinutes.toFixed(1) })}</em>
        </div>
        <div className="tl-overview-bar">
          {filmBlocks.map(block => (
            <button
              key={block.scene.id}
              className={`tl-overview-block c${trackIndex(block.lane)}${block.scene.id === activeScene?.id ? ' active' : ''}`}
              style={{ flexGrow: block.dur }}
              onClick={() => seekToCard(block)}
              title={t('{heading} · {lane} · {dur}′', { heading: block.scene.heading, lane: t(block.lane), dur: block.dur })}
            >
              {String(block.i + 1).padStart(2, '0')}
            </button>
          ))}
          {filmBlocks.length === 0 && <p className="tl-empty">{t('暂无场景')}</p>}
          <span className="tl-overview-playhead" style={{ left: `${playheadPct}%` }} />
        </div>
      </div>

      {/* 场景卡面：单卡片展开，直接改这一场正文 */}
      {cardSceneIndex != null && scenes[cardSceneIndex] && (
        <div className="tl-card-mask" onMouseDown={closeSceneCard}>
          <div
            className="tl-card-face"
            onMouseDown={e => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Escape') closeSceneCard() }}
          >
            <div className="tl-card-face-head">
              <span className="tl-card-face-no">SC {String(cardSceneIndex + 1).padStart(2, '0')}</span>
              <span className="tl-card-face-lane">{t(metaOf(scenes[cardSceneIndex]).storyline)}</span>
              <span className="tl-card-face-hint">{t('改动会自动写回剧本')}</span>
              <button className="tl-mini" onClick={closeSceneCard} title={t('关闭')}>
                <X size={13} />
              </button>
            </div>

            <input
              className="tl-card-face-title"
              value={cardHeading}
              onChange={e => { setCardHeading(e.target.value); queueCardSync(cardSceneIndex, e.target.value, cardBody) }}
              placeholder={t('场景标题')}
            />

            <textarea
              className="tl-card-face-body scroll-noir"
              value={cardBody}
              spellCheck={false}
              onChange={e => { setCardBody(e.target.value); queueCardSync(cardSceneIndex, cardHeading, e.target.value) }}
              placeholder={t('这一场的正文…')}
            />

            <div className="tl-card-face-foot">
              <span>{t('{n} 字', { n: cardBody.replace(/\s/g, '').length })}</span>
              <button className="tl-mini tl-card-face-done" onClick={closeSceneCard}>{t('完成')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 场景属性抽屉 */}
      {inspectorOpen && (
        <aside className="tl-inspector drawer">
          {selected ? (
            <>
              <div className="tl-insp-head">
                <span>{t('场景检视')}</span>
                <button className="tl-mini" onClick={() => setInspectorOpen(false)} title={t('关闭')}>
                  <ChevronRight size={12} />
                </button>
                <button className="tl-mini" onClick={() => onOpenEditor?.()} title={t('在剧本编辑器中打开')}>
                  <ExternalLink size={12} />
                </button>
              </div>

              <label className="tl-field">
                <span>{t('场景标题')}</span>
                <input
                  value={headingDraft}
                  onChange={e => setHeadingDraft(e.target.value)}
                  onBlur={() => renameScene(selected.id, headingDraft)}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                />
              </label>

              <div className="tl-field-row">
                <label className="tl-field">
                  <span>{t('故事时间')}</span>
                  <input
                    placeholder={t('如 2019年冬 / 第3天')}
                    value={metaOf(selected).storyTime}
                    onChange={e => updateSceneMeta(selected.key, { storyTime: e.target.value })}
                  />
                </label>
                <label className="tl-field">
                  <span>{t('预计时长')}</span>
                  <input
                    value={metaOf(selected).duration ?? selected.duration}
                    onChange={e => updateSceneMeta(selected.key, { duration: e.target.value })}
                  />
                </label>
              </div>

              <div className="tl-field-row">
                <label className="tl-field">
                  <span>{t('剧情线')}</span>
                  <input
                    list="tl-storylines"
                    value={metaOf(selected).storyline}
                    onChange={e => updateSceneMeta(selected.key, { storyline: e.target.value })}
                  />
                  <datalist id="tl-storylines">
                    {[...new Set([...STORYLINE_OPTIONS, ...lanes.map(lane => lane.name)])].map(v => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </label>
                <label className="tl-field">
                  <span>{t('戏剧功能')}</span>
                  <select
                    value={metaOf(selected).function}
                    onChange={e => updateSceneMeta(selected.key, { function: e.target.value })}
                  >
                    <option value="">{t('未标注')}</option>
                    {FUNCTION_OPTIONS.map(v => <option key={v} value={v}>{t(v)}</option>)}
                  </select>
                </label>
              </div>

              <div className="tl-storyline-chips">
                {STORYLINE_OPTIONS.map(v => (
                  <button
                    key={v}
                    className={metaOf(selected).storyline === v ? 'active' : ''}
                    onClick={() => updateSceneMeta(selected.key, { storyline: v })}
                    title={t('把本场标注为「{name}」', { name: t(v) })}
                  >{t(v)}</button>
                ))}
              </div>

              <div className="tl-field-row">
                <label className="tl-field">
                  <span>{t('所属幕')}</span>
                  <select
                    value={metaOf(selected).act}
                    onChange={e => updateSceneMeta(selected.key, { act: e.target.value })}
                  >
                    <option value="">{t('未分幕')}</option>
                    {ACT_OPTIONS.map(v => <option key={v} value={v}>{t(v)}</option>)}
                  </select>
                </label>
                <label className="tl-field">
                  <span>{t('场景状态')}</span>
                  <select
                    value={metaOf(selected).status}
                    onChange={e => updateSceneMeta(selected.key, { status: e.target.value })}
                  >
                    {STATUS_OPTIONS.map(v => <option key={v} value={v}>{t(v)}</option>)}
                  </select>
                </label>
              </div>

              <label className="tl-field">
                <span>{t('情绪基调')}</span>
                <input
                  placeholder={t('如 压抑 / 温暖 / 悬疑')}
                  value={metaOf(selected).tone}
                  onChange={e => updateSceneMeta(selected.key, { tone: e.target.value })}
                />
              </label>

              <label className="tl-field">
                <span>{t('场景梗概')}</span>
                <textarea
                  rows={3}
                  value={metaOf(selected).synopsis}
                  onChange={e => updateSceneMeta(selected.key, { synopsis: e.target.value })}
                />
              </label>

              <div className="tl-insp-actions">
                <button onClick={() => moveScene(selected.id, -1)} title={t('上移')}><ArrowUp size={13} /></button>
                <button onClick={() => moveScene(selected.id, 1)} title={t('下移')}><ArrowDown size={13} /></button>
                <button onClick={() => duplicateScene(selected.id)} title={t('复制场景')}><Copy size={13} /></button>
                <button className="danger" onClick={() => removeScene(selected.id)} title={t('归档场景')}>
                  <Archive size={13} /> {t('归档')}
                </button>
              </div>

              <div className="tl-people">
                <span>{t('出场人物')}</span>
                <div>
                  {selected.characters.length
                    ? selected.characters.map(c => <span key={c} className="tl-tag">{c}</span>)
                    : <em>{t('无对白人物')}</em>}
                </div>
              </div>

              {archived.length > 0 && (
                <div className="tl-archived">
                  <span>{t('已归档')}</span>
                  {archived.map(entry => (
                    <div key={entry.key} className="tl-archived-item">
                      <span>{entry.heading}</span>
                      <button className="tl-mini" onClick={() => restoreScene(entry.key)} title={t('恢复')}>
                        <RotateCcw size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="tl-empty">{t('在叙事线上选择一个场景')}</p>
          )}
        </aside>
      )}
    </div>
  )
}
