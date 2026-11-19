import React, { useState, useEffect, useRef, useCallback } from 'react'
import mammoth from 'mammoth'
import JSZip from 'jszip'
import {
  Play, Pause, Square, Save, Download, Upload, Settings, AlertTriangle,
  Users, Clock, FileText, Check, ChevronDown, ChevronUp, Plus, Trash2,
  Wand2, Eye, EyeOff, Lock, Crown, PanelLeftClose, PanelLeftOpen,
  Undo2, Redo2, Bold, Italic, Underline, Strikethrough, Highlighter,
  AlignLeft, AlignCenter, AlignRight, Search, Replace, Columns, Sparkles, X as XIcon, Layers, Image as ImageIcon
} from 'lucide-react'
import { FORMAT_PRESET_LIST, getPresetById } from '../config/formatPresets.js'
import {
  parseScriptText, serializeScript,
  extractCharacters, getScriptStats, ELEMENT_TYPES
} from '../utils/scriptParser.js'
import { inspectScript, fixScriptFormat } from '../utils/scriptInspector.js'
import { exportFountain, exportFDX, importFDX, exportPDF, exportDOCX, exportHTML } from '../utils/exporters.js'
import { extractDocxParagraphs } from '../utils/importers/docxImporter.js'
import { classifyParagraphs } from '../utils/importers/scriptImportClassifier.js'
import { getElementStyle, getPageStyle, decorateEditorHtml } from '../utils/formatStyle.js'
import { paginateDocument, pageMetrics, continuationMarks } from '../utils/paginate.js'
import { listVersions, saveVersion } from '../utils/scriptHistory.js'
import { useLicense } from '../utils/LicenseContext.jsx'
import { getArtById } from '../utils/artLibrary.js'
import { getScript } from '../utils/scriptShelf.js'
import { getStyleById } from '../utils/styleLibrary.js'
import { makeProjectId, saveProject, writeProjectFile } from '../utils/projectStore.js'
import WorkspacePanel from '../components/WorkspacePanel.jsx'
import CharacterMuse from '../components/CharacterMuse.jsx'
import ProjectRail from '../components/ProjectRail.jsx'
import PaperPicker from '../components/PaperPicker.jsx'
import { paperToBackgroundCss, getActivePaper } from '../utils/paperLibrary.js'
import {
  canUse as formatAllowed, FORMAT_ACCESS,
  canUse as exportAllowed, EXPORT_ACCESS,
  PLAN_NAMES, UPGRADE_HINT
} from '../utils/planPermissions.js'
import { useI18n } from '../i18n/index.jsx'

// ============ 每种格式预设正宗范文 ============
const SAMPLES_BY_FORMAT = {

}
// 导入时选择的「稿件用途」：决定把识别结果转换成哪套行业规范
// 只列出仍有可靠出处、且版式/页数确有区别的模板
const IMPORT_PURPOSES = [
  { id: 'hollywood', label: '电影投稿稿', desc: '标准好莱坞 spec，不带场号' },
  { id: 'hollywood-tv', label: '一小时剧集', desc: '版式同电影，单集 50-60 页' },
  { id: 'hollywood-halfhour', label: '半小时喜剧', desc: '版式同电影，单集 25-35 页' },
  { id: 'shooting', label: '拍摄稿', desc: '带锁定场号，供现场使用' },
  { id: 'bbc', label: '英剧 / BBC', desc: '版式同好莱坞，页数 50-70' },
  { id: 'stage', label: '舞台剧本', desc: 'Times 12pt，角色名居中' },
  { id: 'cn-film', label: '中文影视', desc: '内地电影/电视剧/网络剧通用惯例' },
  { id: 'cn-gov', label: '广电申报稿', desc: '三号仿宋、30 磅行距' },
]

// 可选正文字体：全部为可免费商用的开源字体（Google Fonts / SIL OFL）
// family 为 CSS font-family 值；空字符串表示跟随模板默认字体
const FONT_OPTIONS = [
  { id: '', family: '', label: '模板字体' },
  { id: 'courier-prime', family: "'Courier Prime', 'Courier New', monospace", label: 'Courier Prime · 剧本标准' },
  { id: 'special-elite', family: "'Special Elite', 'Courier Prime', monospace", label: 'Special Elite · 打字机' },
  { id: 'jetbrains-mono', family: "'JetBrains Mono', 'Courier Prime', monospace", label: 'JetBrains Mono · 等宽' },
  { id: 'eb-garamond', family: "'EB Garamond', Georgia, serif", label: 'EB Garamond · 文学' },
  { id: 'cormorant', family: "'Cormorant Garamond', Georgia, serif", label: 'Cormorant · 古典' },
  { id: 'inter', family: "'Inter', system-ui, sans-serif", label: 'Inter · 无衬线' },
]

export default function ScriptEditor() {
  const { t } = useI18n()
  const { plan } = useLicense()
  const [formatId, setFormatId] = useState('hollywood')
  const [styleId, setStyleId] = useState('') // 剧作风格库所选风格（存进项目数据）
  const format = getPresetById(formatId)
  // 模板字号（pt）→ 编辑区像素字号；用户手动选过则用用户值
  const presetFontPx = Math.round((format.font?.sizePt || 12) * 4 / 3)
  const sizeOptions = [...new Set([10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 48, 72, presetFontPx])]
    .sort((a, b) => a - b)

  const [text, setText] = useState('')
  const [elements, setElements] = useState([])
  const [showPreview, setShowPreview] = useState(false)
  // 分页结果：编辑区断页线与预览共用同一份数据
  const [pagination, setPagination] = useState(null)

  // 预览浮动窗：位置 + 整页自适应缩放
  const previewFloatRef = useRef(null)
  const previewStageRef = useRef(null)
  const previewPageRef = useRef(null)
  const [previewPos, setPreviewPos] = useState(() => ({
    x: Math.max(16, (typeof window !== 'undefined' ? window.innerWidth : 1440) - 648),
    y: 136,
  }))
  const [previewFit, setPreviewFit] = useState({ w: 0, h: 0, scale: 0.5 })
  const previewFitRef = useRef(previewFit)
  previewFitRef.current = previewFit
  // null = 单页自适应；数值 = 滚轮放大后的绝对比例
  const [previewZoom, setPreviewZoom] = useState(null)
  const previewZoomRef = useRef(previewZoom)
  previewZoomRef.current = previewZoom
  // 预览一次只显示一页，默认把这一页完整放进窗口
  const [previewPage, setPreviewPage] = useState(1)
  // 只放大不缩小：低于单页自适应比例时按自适应比例显示
  const previewScale = Math.max(previewZoom ?? previewFit.scale, previewFit.scale)
  const [showWorkspace, setShowWorkspace] = useState(false) // 构箱栏默认收起

  // === 富文本编辑器状态（"小 Word"） ===
  const [fontSize, setFontSize] = useState(null) // null = 跟随模板字号
  // 正文字体（开源字体，按剧本/个人审美切换；存本机偏好）
  const [fontFamilyId, setFontFamilyId] = useState(() => localStorage.getItem('scriptforge_font') || '')
  const fontFamily = FONT_OPTIONS.find(f => f.id === fontFamilyId)?.family || ''
  useEffect(() => {
    if (fontFamilyId) localStorage.setItem('scriptforge_font', fontFamilyId)
    else localStorage.removeItem('scriptforge_font')
  }, [fontFamilyId])
  const [previewColumns, setPreviewColumns] = useState(1) // 1/2/3 分栏（作用于编辑器）
  const [showFindReplace, setShowFindReplace] = useState(false)
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [findCaseSensitive, setFindCaseSensitive] = useState(false)

  // 助理（桌面陪伴）可见性 —— 工具栏按钮与 H 键都能切
  const [museVisible, setMuseVisible] = useState(() => localStorage.getItem('scriptforge_muse_visible') !== '0')

  // === 剧本架联动 ===
  // 每个进入编辑器的剧本都有一个虚拟目录 id（内存先生成，真正有内容时才落库，避免空剧本堆积）
  const [currentScriptId, setCurrentScriptId] = useState(() => makeProjectId())
  const [scriptTitle, setScriptTitle] = useState('') // 当前剧本标题
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false) // 工具栏向上收纳
  const [railCollapsed, setRailCollapsed] = useState(false) // 项目栏向左收纳
  const [historyOpen, setHistoryOpen] = useState(false)
  const [versions, setVersions] = useState([])
  const historyRef = useRef(null)
  const snapshotAtRef = useRef(0)
  const [lastSavedAt, setLastSavedAt] = useState(null) // 自动保存时间
  const persistedRef = useRef(false)   // 是否已经写进虚拟目录
  const saveTimerRef = useRef(null)
  const latestRef = useRef({})
  latestRef.current = { text, formatId, styleId, scriptTitle, currentScriptId }

  // 壁纸 —— 从 localStorage 读取，订阅 storage 事件跨组件同步
  const [wallpaperId, setWallpaperId] = useState(() => localStorage.getItem('scriptforge_wallpaper'))
  useEffect(() => {
    const handler = (e) => { if (e.key === 'scriptforge_wallpaper') setWallpaperId(e.newValue) }
    window.addEventListener('storage', handler)
    // 定时轮询（WallpaperPicker 在同标签页 setItem 不会触发 storage 事件）
    const poll = setInterval(() => setWallpaperId(localStorage.getItem('scriptforge_wallpaper')), 4000)
    return () => { window.removeEventListener('storage', handler); clearInterval(poll) }
  }, [])
  const currentArt = wallpaperId ? getArtById(wallpaperId) : null
  const [bottomPanel, setBottomPanel] = useState('none') // 'none' | 'validate' | 'stats' | 'both'
  const showValidation = bottomPanel === 'validate' || bottomPanel === 'both'
  const showStats = bottomPanel === 'stats' || bottomPanel === 'both'
  const [formatMenuOpen, setFormatMenuOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [showPaperPicker, setShowPaperPicker] = useState(false)
  const [paperVersion, setPaperVersion] = useState(0) // 稿纸切换后触发编辑器重渲染

  // 跨组件/跨 Tab 订阅稿纸变化
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'scriptforge_paper' || e.key === 'scriptforge_papers_custom') {
        setPaperVersion(v => v + 1)
      }
    }
    window.addEventListener('storage', handler)
    window.addEventListener('paper-cache-ready', handler)
    const poll = setInterval(() => {
      // 每秒检查 localStorage 里的稿纸 id 有没有变（同 Tab 内切换后也同步）
      const cur = localStorage.getItem('scriptforge_paper')
      if (cur !== ScriptEditor._lastPaperId) {
        ScriptEditor._lastPaperId = cur
        setPaperVersion(v => v + 1)
      }
    }, 800)
    ScriptEditor._lastPaperId = localStorage.getItem('scriptforge_paper')
    return () => { window.removeEventListener('storage', handler); window.removeEventListener('paper-cache-ready', handler); clearInterval(poll) }
  }, [])

  // 导入确认：先问「这份稿子要拿去干什么」，再决定转换目标规范
  const [importQueue, setImportQueue] = useState(null) // { file }
  const [importPurpose, setImportPurpose] = useState('hollywood')
  const [importBusy, setImportBusy] = useState(false)

  const [validation, setValidation] = useState({ critical: [], warnings: [], structural: [], suggestions: [] })
  const [stats, setStats] = useState({})
  const [saved, setSaved] = useState(false)

  const textareaRef = useRef(null)
  const formatMenuRef = useRef(null)
  const exportMenuRef = useRef(null)

  // ========== Undo/Redo 历史记录 ==========
  // ========== 富文本编辑器（contentEditable）==========
  const editorRef = useRef(null)

  // 打开剧本的逻辑见下方 loadScriptIntoEditor

  // 把正文按当前模板装饰成段落块（编辑区与预览共用 formatStyle 的同一套样式）
  const renderEditor = useCallback((sourceText, fid) => {
    const editor = editorRef.current
    if (!editor) return
    const preset = getPresetById(fid)
    const parsed = parseScriptText(sourceText, fid)
    const html = decorateEditorHtml(sourceText, preset, parsed)
    if (editor.innerHTML !== html) editor.innerHTML = html
  }, [])

  // 初始化
  useEffect(() => {
    if (editorRef.current) renderEditor(text, formatId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 切换模板：正文不动，只按新模板重新排版编辑区
  useEffect(() => {
    const current = latestRef.current.text
    if (current != null) renderEditor(current, formatId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatId])

  // 范文切换时同步（只在正文确实是某篇范文时才读编辑器，避免每次输入都触发一次 innerText 布局）
  useEffect(() => {
    const isSample = Object.values(SAMPLES_BY_FORMAT).includes(text)
    if (!isSample) return
    const editor = editorRef.current
    if (!editor) return
    if (editor.innerText !== text) renderEditor(text, formatId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  // ========== 撤销/重做（浏览器原生） ==========
  const undo = () => { editorRef.current?.focus(); document.execCommand('undo') }
  const redo = () => { editorRef.current?.focus(); document.execCommand('redo') }

  // ========== 文本格式化（execCommand 直接作用于编辑器） ==========
  const exec = (cmd, val = null) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, val)
    // 同步到 state
    if (editorRef.current) setText(editorRef.current.innerText)
  }

  const applyBold = () => exec('bold')
  const applyItalic = () => exec('italic')
  const applyUnderline = () => exec('underline')
  const applyStrike = () => exec('strikeThrough')
  const applyHighlight = () => exec('hiliteColor', 'rgba(201,168,76,0.45)')
  const applyColor = (color) => exec('foreColor', color)

  // 字号：execCommand('fontSize') 只支持 1-7，用 size=7 + 后处理替换为精确像素
  const applySize = (size) => {
    setFontSize(size)
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    const sel = window.getSelection()
    if (sel.isCollapsed) return // 没选中文字就只改整体字号
    document.execCommand('fontSize', false, '7')
    editor.querySelectorAll('font[size="7"]').forEach(el => {
      const span = document.createElement('span')
      span.style.fontSize = size + 'px'
      span.innerHTML = el.innerHTML
      el.replaceWith(span)
    })
    setText(editor.innerText)
  }

  // 对齐：execCommand justify* 直接作用于编辑器当前段落
  const applyAlign = (align) => {
    const cmd = 'justify' + align.charAt(0).toUpperCase() + align.slice(1) // justifyLeft/Center/Right
    exec(cmd)
  }

  // ========== 查找替换（基于 innerText + Range API） ==========
  const findMatches = (() => {
    if (!findText) return []
    const flags = findCaseSensitive ? 'g' : 'gi'
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(escaped, flags)
    const matches = []
    let m
    while ((m = re.exec(text)) !== null) {
      matches.push({ index: m.index, length: m[0].length })
      if (m.index === re.lastIndex) re.lastIndex++
    }
    return matches
  })()

  // 把 innerText 字符偏移映射为 DOM Range
  const getRangeAt = (charOffset, charLength) => {
    const editor = editorRef.current
    if (!editor) return null
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
    let pos = 0
    let startNode = null, startOff = 0, endNode = null, endOff = 0
    while (walker.nextNode()) {
      const node = walker.currentNode
      const len = node.textContent.length
      if (!startNode && pos + len > charOffset) {
        startNode = node
        startOff = charOffset - pos
      }
      if (startNode && pos + len >= charOffset + charLength) {
        endNode = node
        endOff = charOffset + charLength - pos
        break
      }
      pos += len
    }
    if (!startNode || !endNode) return null
    const range = document.createRange()
    range.setStart(startNode, startOff)
    range.setEnd(endNode, endOff)
    return range
  }

  const replaceNext = () => {
    if (!findText || findMatches.length === 0) return
    const first = findMatches[0]
    const range = getRangeAt(first.index, first.length)
    if (!range) return
    range.deleteContents()
    range.insertNode(document.createTextNode(replaceText))
    setText(editorRef.current.innerText)
  }
  const replaceAll = () => {
    if (!findText) return
    const flags = findCaseSensitive ? 'g' : 'gi'
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(escaped, flags)
    const editor = editorRef.current
    // 简单方案：直接重置 innerText（会丢失格式，但 replaceAll 本来就是批量操作）
    editor.innerText = text.replace(re, replaceText)
    setText(editor.innerText)
  }

  // ========== 快捷键 ==========
  useEffect(() => {
    const handler = (e) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo() }
      else if (e.key === 'f') { e.preventDefault(); setShowFindReplace(true) }
      else if (e.key === 'b') { e.preventDefault(); applyBold() }
      else if (e.key === 'i') { e.preventDefault(); applyItalic() }
      else if (e.key === 'u') { e.preventDefault(); applyUnderline() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, text])

  // 模板切换直接读取编辑器里的最新正文。只有当前确实仍是例文时才换例文，
  // 用户导入或创作的内容始终做结构转换，绝不被例文覆盖。
  const handleFormatChange = (nextFormatId) => {
    setFormatMenuOpen(false)
    const editor = editorRef.current
    const currentText = editor?.innerText ?? text
    const isSampleText = Object.values(SAMPLES_BY_FORMAT).some(sample => sample.trim() === currentText.trim())

    // 例文已经是当前模板时无需重复处理
    if (nextFormatId === formatId && isSampleText) return

    // 新模板没有内置例文时，用当前例文按新模板重新排版，避免出现 undefined
    const nextText = isSampleText
      ? (SAMPLES_BY_FORMAT[nextFormatId]
        || serializeScript(parseScriptText(currentText), nextFormatId)
        || currentText)
      : (serializeScript(parseScriptText(currentText), nextFormatId) || currentText)

    setFormatId(nextFormatId)
    setText(nextText)
    // 直接按新模板重排编辑区，避免先写入纯文本再等 effect 重排
    renderEditor(nextText, nextFormatId)
    scheduleSave()
  }

  // 粘贴整段剧本时自动识别并排版；短文本粘贴保持浏览器默认行为
  const handlePaste = (e) => {
    const raw = e.clipboardData?.getData('text/plain')
    if (!raw) return
    const looksLikeScript = raw.length >= 120 || raw.split('\n').filter(l => l.trim()).length >= 3
    if (!looksLikeScript) return

    e.preventDefault()
    const formatted = serializeScript(parseScriptText(raw), latestRef.current.formatId) || raw
    const editor = editorRef.current
    const sel = window.getSelection()
    if (editor && sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0)
      range.deleteContents()
      const node = document.createTextNode(formatted)
      range.insertNode(node)
      range.setStartAfter(node)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    } else if (editor) {
      editor.innerText = formatted
    }
    setText(editor?.innerText ?? formatted)
    scheduleSave()
  }

  // 解析和校验（停止输入后再跑，避免每敲一个字就全量解析 + 校验）
  useEffect(() => {
    const timer = setTimeout(() => {
      const parsed = parseScriptText(text, formatId)
      setElements(parsed)
      const result = inspectScript(parsed, format)
      setValidation(result)
      setStats(getScriptStats(parsed, format))
      setSaved(false)
    }, 260)
    return () => clearTimeout(timer)
  }, [text, formatId, format])

  // 真实分页：停止输入 0.5 秒、且浏览器空闲时再量（量高度会触发布局，打字时不能跑）
  useEffect(() => {
    if (!text.trim()) { setPagination(null); return }
    let idleId = 0
    const timer = setTimeout(() => {
      const run = () => {
        const preset = getPresetById(formatId)
        const parsed = parseScriptText(text, formatId)
        const html = decorateEditorHtml(text, preset, parsed)
        const result = paginateDocument(html, preset, {
          fontSizePx: fontSize ?? Math.round((preset.font?.sizePt || 12) * 4 / 3),
          fontFamily: fontFamily || undefined,
        })
        setPagination({ ...result, html })
      }
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(run, { timeout: 800 })
      } else {
        run()
      }
    }, 500)
    return () => {
      clearTimeout(timer)
      if (idleId) window.cancelIdleCallback?.(idleId)
    }
  }, [text, formatId, fontSize, fontFamily])

  // 预览单页自适应：把当前页完整放进舞台，不缩放整份文档
  useEffect(() => {
    if (!showPreview) return
    const stage = previewStageRef.current
    const page = previewPageRef.current
    if (!stage || !page) return

    const measure = () => {
      // 实际渲染比例可能高于自适应比例，先还原成纸张真实尺寸
      const fit = previewFitRef.current.scale || 0.5
      const current = Math.max(previewZoomRef.current ?? fit, fit) || 0.5
      const rect = page.getBoundingClientRect()
      const w = rect.width / current || page.offsetWidth
      const h = rect.height / current || page.offsetHeight
      if (!w || !h) return
      // 直接按预览框的实际尺寸撑满，不再预留黑边
      const availW = Math.max(120, stage.clientWidth)
      const availH = Math.max(120, stage.clientHeight)
      // 用「填满」而不是「完整放进」：按较紧的一边撑满，纸面铺满预览框，不留黑边
      const scale = Math.max(0.1, Math.min(2, Math.max(availW / w, availH / h)))
      setPreviewFit(prev => (
        Math.abs(prev.w - w) < 0.5 &&
        Math.abs(prev.h - h) < 0.5 &&
        Math.abs(prev.scale - scale) < 0.002
          ? prev
          : { w, h, scale }
      ))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    observer.observe(page)
    return () => observer.disconnect()
  }, [showPreview, text, formatId, pagination?.totalPages, previewPage])

  // 页数变化时把当前页夹在有效范围内
  useEffect(() => {
    const total = pagination?.totalPages || 1
    setPreviewPage(p => Math.min(Math.max(1, p), total))
  }, [pagination?.totalPages])

  // 换页后回到页首
  useEffect(() => {
    const stage = previewStageRef.current
    if (stage) { stage.scrollTop = 0; stage.scrollLeft = 0 }
  }, [previewPage, formatId])

  // 滚轮放大（以鼠标位置为中心；最小为单页自适应比例，不缩小）
  useEffect(() => {
    if (!showPreview) return
    const stage = previewStageRef.current
    if (!stage) return

    const onWheel = (e) => {
      e.preventDefault()
      const fit = previewFitRef.current.scale || 0.5
      const base = Math.max(previewZoomRef.current ?? fit, fit)
      const next = Math.min(2.5, Math.max(fit, base * Math.exp(-e.deltaY * 0.0016)))
      if (Math.abs(next - base) < 0.001) return
      setPreviewZoom(next)

      // 让鼠标指向的正文位置保持不动
      const rect = stage.getBoundingClientRect()
      const ax = e.clientX - rect.left + stage.scrollLeft
      const ay = e.clientY - rect.top + stage.scrollTop
      const k = next / base
      requestAnimationFrame(() => {
        stage.scrollLeft = ax * k - (e.clientX - rect.left)
        stage.scrollTop = ay * k - (e.clientY - rect.top)
      })
    }

    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [showPreview])

  // 放大后可在预览内按住拖动平移（此时滚轮仍用于缩放）
  const startPreviewPan = (e) => {
    if (!previewZoom || e.button !== 0) return
    const stage = previewStageRef.current
    if (!stage) return
    if (stage.scrollWidth <= stage.clientWidth && stage.scrollHeight <= stage.clientHeight) return
    e.preventDefault()
    const start = { x: e.clientX, y: e.clientY, left: stage.scrollLeft, top: stage.scrollTop }
    const onMove = (ev) => {
      stage.scrollLeft = start.left - (ev.clientX - start.x)
      stage.scrollTop = start.top - (ev.clientY - start.y)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // 拖动预览浮窗（限制在视口内）
  const startPreviewDrag = (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    const el = previewFloatRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const drag = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, w: rect.width, h: rect.height }

    const onMove = (ev) => {
      const maxX = Math.max(8, window.innerWidth - drag.w - 8)
      const maxY = Math.max(8, window.innerHeight - drag.h - 8)
      setPreviewPos({
        x: Math.min(Math.max(8, ev.clientX - drag.dx), maxX),
        y: Math.min(Math.max(8, ev.clientY - drag.dy), maxY),
      })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // 视口变化时把浮窗收回可视区域
  useEffect(() => {
    const onResize = () => {
      const el = previewFloatRef.current
      const w = el?.offsetWidth || 560
      const h = el?.offsetHeight || 700
      setPreviewPos(p => ({
        x: Math.min(p.x, Math.max(8, window.innerWidth - w - 8)),
        y: Math.min(p.y, Math.max(8, window.innerHeight - h - 8)),
      }))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (formatMenuRef.current && !formatMenuRef.current.contains(e.target)) {
        setFormatMenuOpen(false)
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportMenuOpen(false)
      }
      if (historyRef.current && !historyRef.current.contains(e.target)) {
        setHistoryOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleExport = useCallback(async (type) => {
    try {
      const currentText = editorRef.current?.innerText ?? text
      if (!currentText.trim()) throw new Error(t('正文为空，请先写入或导入剧本'))
      const currentElements = parseScriptText(currentText, formatId)
      const meta = {
        title: latestRef.current.scriptTitle || '未命名剧本',
      }
      switch (type) {
        case 'pdf':
          await exportPDF(currentElements, formatId, meta)
          break
        case 'fountain':
          exportFountain(currentElements)
          break
        case 'fdx':
          exportFDX(currentElements, formatId)
          break
        case 'docx':
          await exportDOCX(currentElements, formatId)
          break
        case 'html':
          exportHTML(currentElements, formatId)
          break
      }
    } catch (err) {
      alert(t('导出失败：{msg}', { msg: err.message || err }))
    } finally {
      setExportMenuOpen(false)
    }
  }, [formatId, text, t])

  // ========== 自动保存：正文写进该剧本的虚拟目录 ==========
  const persistNow = useCallback(async (force = false) => {
    const { text: t, formatId: f, styleId: sid, scriptTitle: title, currentScriptId: id } = latestRef.current
    if (!id) return
    const content = editorRef.current?.innerText ?? t
    const sample = (SAMPLES_BY_FORMAT[f] || '').trim()
    // 没动过的范文不落库，避免每进一次编辑器就多一个空剧本
    if (!force && (!content.trim() || (!persistedRef.current && content.trim() === sample))) return

    const now = new Date().toISOString()
    await saveProject({
      id,
      title: title || '未命名剧本',
      formatId: f,
      styleId: sid,
      contentLength: content.length,
      createdAt: persistedRef.current ? undefined : now,
      updatedAt: now,
    })
    await writeProjectFile(id, 'script.md', content)
    localStorage.setItem('scriptforge_current_script', JSON.stringify({ text: content, formatId: f, savedAt: now }))
    persistedRef.current = true
    setLastSavedAt(new Date())
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)

    // 版本快照：首次保存必存，之后最多每 3 分钟一次
    const nowMs = Date.now()
    if (nowMs - snapshotAtRef.current > 3 * 60 * 1000) {
      snapshotAtRef.current = nowMs
      saveVersion(id, { title: title || '未命名剧本', formatId: f, text: content }).catch(() => {})
    }
  }, [])

  const scheduleSave = useCallback((delay = 1200) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => { persistNow().catch(() => {}) }, delay)
  }, [persistNow])

  const handleSave = () => {
    snapshotAtRef.current = Date.now() // 手动保存时由下面单独写快照，避免重复
    Promise.resolve(persistNow(true))
      .then(() => {
        const content = editorRef.current?.innerText ?? ''
        const { scriptTitle: title, formatId: f, currentScriptId: id } = latestRef.current
        return saveVersion(id, { title: title || '未命名剧本', formatId: f, text: content })
      })
      .then(() => { snapshotAtRef.current = Date.now() })
      .catch(e => console.warn('保存失败', e))
  }

  // 版本快照列表 / 恢复
  const toggleHistory = useCallback(async () => {
    const next = !historyOpen
    setHistoryOpen(next)
    if (next) {
      try { setVersions(await listVersions(currentScriptId)) } catch { setVersions([]) }
    }
  }, [historyOpen, currentScriptId])

  const restoreVersion = useCallback((row) => {
    if (!row) return
    setText(row.text || '')
    setFormatId(row.formatId || formatId)
    if (row.title) setScriptTitle(row.title)
    if (editorRef.current) renderEditor(row.text || '', row.formatId || formatId)
    setHistoryOpen(false)
    scheduleSave()
  }, [formatId, scheduleSave])

  // 一键修复可自动处理的格式问题（角色名统一、空段落、尾随空格）
  const handleAutoFix = useCallback(() => {
    const editor = editorRef.current
    const currentText = editor?.innerText ?? text
    const parsed = parseScriptText(currentText, formatId)
    const { elements: fixed, changes } = fixScriptFormat(parsed)
    if (!changes.length) return
    const nextText = serializeScript(fixed, formatId)
    setText(nextText)
    if (editor) editor.innerText = nextText
    scheduleSave()
    setBottomPanel('validate')
  }, [text, formatId, scheduleSave])

  // 离开编辑器时把最后一批改动写进去
  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    persistNow().catch(() => {})
  }, [persistNow])

  // ========== 打开指定剧本（剧本架 → 编辑器 / 切标签后恢复）==========
  const loadScriptIntoEditor = useCallback(async (id) => {
    if (!id) return null
    await persistNow().catch(() => {})
    const script = await getScript(id)
    if (!script) return null
    setText(script.content || '')
    setFormatId(script.formatId || 'hollywood')
    setStyleId(script.styleId || localStorage.getItem(`scriptforge_style_${id}`) || '')
    setCurrentScriptId(script.id)
    setScriptTitle(script.title || '未命名剧本')
    persistedRef.current = true
    setLastSavedAt(new Date(script.updatedAt || Date.now()))
    if (editorRef.current) renderEditor(script.content || '', script.formatId || formatId)
    return script
  }, [persistNow])

  // mount：优先打开剧本架指定的剧本，否则恢复上次正在写的剧本
  useEffect(() => {
    const openId = localStorage.getItem('scriptforge_open_script_id')
    const activeId = localStorage.getItem('scriptforge_active_script_id')
    localStorage.removeItem('scriptforge_open_script_id')
    const targetId = openId || activeId
    if (!targetId) return
    let alive = true
    ;(async () => {
      const script = await loadScriptIntoEditor(targetId)
      // 上次写的剧本已被删除 → 换新 id，避免把它复活
      if (alive && !script && !openId) setCurrentScriptId(makeProjectId())
    })()
    return () => { alive = false }
  }, [loadScriptIntoEditor])

  // 剧本架里点「在编辑器打开」时通知已挂载的编辑器
  useEffect(() => {
    const handler = (e) => { loadScriptIntoEditor(e.detail?.id).catch(() => {}) }
    window.addEventListener('scriptforge:open-script', handler)
    return () => window.removeEventListener('scriptforge:open-script', handler)
  }, [loadScriptIntoEditor])

  // 记住当前剧本，切标签 / 刷新后能接着写
  useEffect(() => {
    if (currentScriptId) localStorage.setItem('scriptforge_active_script_id', currentScriptId)
  }, [currentScriptId])

  // 风格库套用后同步徽章（同一项目内立即生效）
  useEffect(() => {
    const handler = (e) => {
      const { projectId: pid, styleId: sid } = e.detail || {}
      if (!pid || pid === currentScriptId) setStyleId(sid || '')
    }
    window.addEventListener('scriptforge:style-changed', handler)
    return () => window.removeEventListener('scriptforge:style-changed', handler)
  }, [currentScriptId])

  // 光标位置 → 百分比，供风格库判断「当前位置落在哪个阶段」
  useEffect(() => {
    let lastAt = 0
    const handler = () => {
      const editor = editorRef.current
      if (!editor) return
      const sel = window.getSelection()
      if (!sel || !sel.anchorNode || !editor.contains(sel.anchorNode)) return
      const now = Date.now()
      if (now - lastAt < 300) return
      lastAt = now
      const range = document.createRange()
      range.selectNodeContents(editor)
      try { range.setEnd(sel.anchorNode, sel.anchorOffset) } catch { return }
      const before = range.toString().length
      const total = editor.innerText.length || 1
      const pct = Math.min(100, Math.max(0, (before / total) * 100))
      localStorage.setItem('scriptforge_cursor_pct', String(pct.toFixed(1)))
      window.dispatchEvent(new CustomEvent('scriptforge:cursor', { detail: { pct } }))
    }
    document.addEventListener('selectionchange', handler)
    return () => document.removeEventListener('selectionchange', handler)
  }, [])

  // ============ 导入剧本文件 + 自动格式化 ============
  // 支持格式（浏览器端纯 JS 可解析的文字载体）
  const TEXT_EXT   = ['txt','fountain','md','markdown','csv','tsv','json','xml','yml','yaml','log','text']
  const HTML_EXT   = ['html','htm','xhtml']
  const OFFICE_DOCX = ['docx']
  const ODF_EXT    = ['odt','ods','odp']          // OpenDocument（LibreOffice / WPS 另存）
  const EPUB_EXT   = ['epub']
  const RTF_EXT    = ['rtf']
  const LEGACY_DOC = ['doc']                      // Office 97-2003 OLE 二进制，浏览器无解
  const NOT_SUPPORTED = [
    'xls','xlsx','xlsm','xlsb','ppt','pptx','pptm',
    'pages','numbers','key','pdf','eml','msg','pst',
    'psd','ai','sketch','fig',                     // 设计源文件
    'png','jpg','jpeg','webp','gif','bmp','heic',  // 图片（不接 OCR）
    'mp3','wav','flac','mp4','mov','avi','mkv',    // 音视频
    'zip','rar','7z','tar','gz','exe','dmg','msi' // 二进制
  ]

  // 用格式表判断文件类型（按优先级从高到低）
  const classifyFile = (name) => {
    const ext = (name.match(/\.([a-zA-Z0-9]+)$/)?.[1] || '').toLowerCase()
    if (OFFICE_DOCX.includes(ext)) return 'docx'
    if (LEGACY_DOC.includes(ext)) return 'legacy-doc'
    if (EPUB_EXT.includes(ext))   return 'epub'
    if (ODF_EXT.includes(ext))    return 'odf'
    if (RTF_EXT.includes(ext))    return 'rtf'
    if (HTML_EXT.includes(ext))   return 'html'
    if (TEXT_EXT.includes(ext) || !ext) return 'text'
    if (NOT_SUPPORTED.includes(ext)) return 'not-supported'
    return 'text' // 未知后缀一律当纯文本试
  }

  // 纯文本 → 清洗 RTF 控制字
  const stripRTF = (s) => {
    // 去 {\xxx} 块（大括号配对）
    let out = ''
    let depth = 0
    for (let i = 0; i < s.length; i++) {
      const c = s[i]
      if (c === '{') depth++
      else if (c === '}') { if (depth > 0) depth--; continue }
      else if (depth === 0) out += c
    }
    // 去 RTF 控制字（\xxxN  这种）
    out = out.replace(/\\[a-zA-Z]+\s?/g, '')
    out = out.replace(/\\u-?\d+ ?/g, '')
    out = out.replace(/\\[0-9a-fA-F]{2}/g, '')
    return out.trim()
  }

  // HTML 字符串 → 纯文字（保留换行）
  const htmlToText = (html) => {
    // 先把 <br> 和 <p> / <div> 换成换行
    const replaced = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|tr|blockquote|section|article|pre)>/gi, '\n')
      .replace(/<head[\s\S]*?<\/head>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
    try {
      const doc = new DOMParser().parseFromString(replaced, 'text/html')
      return (doc.body?.innerText || '').trim()
    } catch {
      return replaced.replace(/<[^>]+>/g, '').trim()
    }
  }

  // JSZip 解包后从多个 entry 抽文字（按优先级）
  const extractFromZip = async (buf, textSelectors) => {
    const zip = await JSZip.loadAsync(buf)
    // 先按文本选择器找
    for (const sel of textSelectors) {
      const entry = zip.file(sel)
      if (entry) {
        const text = await entry.async('string')
        return text.trim()
      }
    }
    // 兜底：遍历所有 .html / .htm / .xhtml / .xml / .txt
    const candidates = Object.keys(zip.files).filter(n =>
      /\.(html|htm|xhtml|xml|txt)$/i.test(n) && !n.startsWith('META-INF/')
    )
    let merged = ''
    for (const name of candidates) {
      const t = await zip.file(name).async('string')
      merged += (merged ? '\n\n' : '') + t
    }
    return merged.trim()
  }

  // 统一入口：文件 → 纯文字
  const extractTextFromFile = async (file) => {
    const kind = classifyFile(file.name)

    if (kind === 'legacy-doc') {
      throw new Error(
        t('老版 Word 格式 (.doc) 浏览器无法直接解析。\n\n请在 Word 里「文件 → 另存为」\n选择类型：**Word 文档 (*.docx)**\n然后再导入一次即可。')
      )
    }

    if (kind === 'not-supported') {
      throw new Error(
        t('这个格式暂时不支持。可导入的格式有：\n\n' +
        '文字：.txt .fountain .md .csv .tsv .json .yml .xml\n' +
        '文档：.docx .odt .ods .odp .rtf .html .epub\n\n' +
        '请另存为以上任一种再导入。')
      )
    }

    if (kind === 'docx') {
      const buf = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer: buf })
      return (result.value || '').trim()
    }

    if (kind === 'epub') {
      const buf = await file.arrayBuffer()
      // EPUB 是 ZIP + XHTML；content.opf 列出正文文件
      const raw = await extractFromZip(buf, [])
      // 里面是 XHTML，还要再抽文字
      return htmlToText(raw)
    }

    if (kind === 'odf') {
      const buf = await file.arrayBuffer()
      // ODF 的 content.xml 是 OpenDocument XML，里面 <text:> 元素就是文字
      const raw = await extractFromZip(buf, ['content.xml', 'styles.xml'])
      const doc = new DOMParser().parseFromString(raw, 'text/xml')
      // 把所有 text: 元素的 textContent 拼起来，段落元素之间插换行
      const paras = Array.from(doc.querySelectorAll('*'))
      let out = ''
      for (const el of paras) {
        const tag = el.tagName.toLowerCase()
        if (tag.startsWith('text:p')) {
          out += '\n' + (el.textContent || '')
        } else if (tag.startsWith('text:span') && !out.endsWith(' ')) {
          const t = el.textContent || ''
          if (t && !out.endsWith('\n')) out += t
        }
      }
      // 如果上面没抓到（比如 ODS/ODP），退回去用纯文本
      const trimmed = out.trim()
      if (trimmed.length > 20) return trimmed
      return raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    }

    if (kind === 'html') {
      const text = await file.text()
      return htmlToText(text)
    }

    if (kind === 'rtf') {
      const text = await file.text()
      return stripRTF(text)
    }

    // 纯文本族
    const text = await file.text()
    return text.trim()
  }

  // 抽完文字后套用选定的目标规范（导入用途），不再根据文件内容擅自跳回好莱坞模板。
  const runImportPipeline = async (file, raw, options = {}) => {
    if (!options.elements && !raw) { alert(t('文件里没读到文字，可能是空文件')); return }
    const nextFormat = options.formatId || latestRef.current.formatId || formatId
    let finalText = raw
    let formatWarning = ''
    let structureNote = ''

    try {
      const parsed = options.elements || parseScriptText(raw)
      finalText = serializeScript(parsed, nextFormat) || raw || parsed.map(el => el.text).join('\n')
      if (options.elements) {
        const scenes = parsed.filter(el => el.type === ELEMENT_TYPES.SLUGLINE).length
        const dialogues = parsed.filter(el => el.type === ELEMENT_TYPES.DIALOGUE).length
        structureNote = t('\n结构识别：{scenes} 场 · {dialogues} 段对白 · {elements} 个元素', { scenes, dialogues, elements: parsed.length })
      }
    } catch (err) {
      formatWarning = t('\n自动排版未完成，已保留原文：{msg}', { msg: err.message || err })
    }

    setFormatId(nextFormat)
    setText(finalText)
    if (editorRef.current) renderEditor(finalText, nextFormat)
    const title = file.name.replace(/\.[^.]+$/, '')
    setScriptTitle(title)

    try {
      const id = latestRef.current.currentScriptId
      const now = new Date().toISOString()
      await saveProject({
        id, title, formatId: nextFormat,
        contentLength: finalText.length,
        createdAt: persistedRef.current ? undefined : now,
        updatedAt: now,
      })
      await writeProjectFile(id, 'script.md', finalText)
      persistedRef.current = true
      setLastSavedAt(new Date())
      alert(t('导入成功：{file}\n已套用：{format}{structure}\n正文已保存到本地剧本文件夹{warning}', {
        file: file.name,
        format: getPresetById(nextFormat)?.name || nextFormat,
        structure: structureNote,
        warning: formatWarning,
      }))
    } catch (err) {
      alert(t('文件已导入并套用模板，但本地保存失败：{msg}{warning}', { msg: err.message || err, warning: formatWarning }))
    }
  }

  // 真正的导入动作：按选定用途解析 → 转换 → 排版
  const importFile = async (file, purposeFormat) => {
    try {
      if (/\.fdx$/i.test(file.name)) {
        const elements = importFDX(await file.text())
        if (!elements.length) throw new Error(t('这个 .fdx 文件里没有可识别的剧本段落'))
        await runImportPipeline(file, '', { elements, formatId: purposeFormat })
        return
      }

      // DOCX：直接读 OOXML，用 Word 样式 / 缩进 / 居中判断元素类型
      if (classifyFile(file.name) === 'docx') {
        let elements = null
        try {
          const buf = await file.arrayBuffer()
          elements = classifyParagraphs(await extractDocxParagraphs(buf))
        } catch {
          elements = null // 结构性解析失败时回退纯文本
        }
        if (elements?.length) {
          await runImportPipeline(file, '', { elements, formatId: purposeFormat })
          return
        }
      }

      const raw = await extractTextFromFile(file)
      await runImportPipeline(file, raw, { formatId: purposeFormat })
    } catch (err) {
      alert(err.message || String(err))
    }
  }

  // 选中文件后先弹「稿件用途」，确认后再导入
  const handleImport = async (file) => {
    if (!file) return
    const known = IMPORT_PURPOSES.some(item => item.id === formatId)
    setImportPurpose(known ? formatId : 'hollywood')
    setImportQueue({ file })
  }

  const confirmImport = async () => {
    const file = importQueue?.file
    if (!file) return
    setImportQueue(null)
    setImportBusy(true)
    try {
      await importFile(file, importPurpose)
    } finally {
      setImportBusy(false)
    }
  }

  const loadSaved = () => {
    try {
      const savedData = localStorage.getItem('scriptforge_current_script')
      if (savedData) {
        const data = JSON.parse(savedData)
        setText(data.text || '')
        setFormatId(data.formatId || 'hollywood')
        if (editorRef.current) renderEditor(data.text || '', data.formatId || 'hollywood')
      }
    } catch {}
  }

  const loadExample = () => {
    const sample = SAMPLES_BY_FORMAT[formatId] || SAMPLES_BY_FORMAT.hollywood
    setText(sample)
    if (editorRef.current) renderEditor(sample, formatId)
  }

  // 快捷插入元素 —— 用 Selection API 在当前光标位置插入纯文本
  const insertAtCursor = (template = '') => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    const sel = window.getSelection()
    if (sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    range.deleteContents()
    const textNode = document.createTextNode(template)
    range.insertNode(textNode)
    range.setStartAfter(textNode)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
    setText(editor.innerText)
  }

  // 各元素模板 —— \u200B 零宽空格标记光标位置
  const insertScene = () => insertAtCursor('\n\nINT. LOCATION - DAY\n\n', 0)
  const insertCharacter = () => insertAtCursor('\n\nCHARACTER\n', 0)
  const insertAction = () => insertAtCursor('(action)', 0)
  const insertTransition = () => insertAtCursor('\n\nFADE OUT.\n', 0)
  const insertDialogue = () => insertAtCursor('\n  ', 0)

  // 键盘：Enter 智能补全（用 Selection API 取当前行）
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      const sel = window.getSelection()
      if (sel.rangeCount === 0) return
      const range = sel.getRangeAt(0)
      // 拿到光标前的文本（用于判断当前行）
      const preRange = range.cloneRange()
      preRange.selectNodeContents(editorRef.current)
      preRange.setEnd(range.startContainer, range.startOffset)
      const beforeText = preRange.toString()
      const currentLine = beforeText.split('\n').pop().trim()

      // 角色名（全大写 + 长度 > 1 + 无 .）→ 补对话缩进
      if (currentLine && currentLine === currentLine.toUpperCase() && currentLine.length > 1 && !currentLine.includes('.')) {
        e.preventDefault()
        insertAtCursor('\n  ')
        return
      }
      // 空行 → 补场景头模板
      if (currentLine === '') {
        e.preventDefault()
        insertAtCursor('\nINT. LOCATION - DAY\n\n')
        return
      }
    }
  }

  return (
    <div className="h-full w-full flex flex-col relative">
      {/* 工具栏 —— 两行布局，第一行编辑原语、第二行文件/场景/面板；可向上收纳 */}
      {toolbarCollapsed ? (
        <button
          onClick={() => setToolbarCollapsed(false)}
          className="h-8 flex items-center justify-center gap-2 border-b border-white/5 bg-noir-900/40 text-[10px] uppercase tracking-[0.25em] text-ivory-400 hover:text-gold-400 hover:bg-noir-800/60 transition-colors"
          title={t('展开工具栏')}
        >
          <ChevronDown size={13} />
          {t('展开工具栏')}
          <span className="text-ivory-500/70 normal-case tracking-normal">{format.name}</span>
        </button>
      ) : (
      <div className="relative z-30 bg-white/6 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),inset_0_-1px_0_0_rgba(255,255,255,0.03),0_10px_26px_-16px_rgba(0,0,0,0.85)]">
        {/* === 第一行：编辑原语 + 助理 + 分栏预览 === */}
        <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap">
          {/* 构箱开关 */}
          <button
            onClick={() => setShowWorkspace(!showWorkspace)}
            className={`px-3 py-2 border text-sm font-medium flex items-center gap-2 transition-colors ${
              showWorkspace
                ? 'border-gold-500 text-gold-400 bg-gold-500/10'
                : 'border-noir-600 text-ivory-300 hover:border-gold-500/50 hover:text-gold-400'
            }`}
            title={showWorkspace ? t('收起构箱栏') : t('展开构箱栏')}
          >
            {showWorkspace ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            {t('构箱')}
          </button>

          <div className="h-6 w-px bg-noir-700" />

          {/* === 撤销/重做 === */}
          <div className="flex items-center gap-0.5">
            <ToolBtn icon={Undo2} title={t('撤销 (Ctrl+Z)')} onClick={undo} />
            <ToolBtn icon={Redo2} title={t('重做 (Ctrl+Y)')} onClick={redo} />
          </div>

          <div className="h-6 w-px bg-noir-700" />

          {/* === 文本格式化 === */}
          <div className="flex items-center gap-0.5">
            <ToolBtn icon={Bold} title={t('粗体 (Ctrl+B)')} onClick={applyBold} />
            <ToolBtn icon={Italic} title={t('斜体 (Ctrl+I)')} onClick={applyItalic} />
            <ToolBtn icon={Underline} title={t('下划线 (Ctrl+U)')} onClick={applyUnderline} />
            <ToolBtn icon={Strikethrough} title={t('删除线')} onClick={applyStrike} />
            <ToolBtn icon={Highlighter} title={t('高亮')} onClick={applyHighlight} />
          </div>

          <div className="h-6 w-px bg-noir-700" />

          {/* === 字号 === */}
          <select
            value={fontSize ?? presetFontPx}
            onChange={e => { const s = Number(e.target.value); setFontSize(s); applySize(s) }}
            className="px-2 py-1.5 bg-noir-800 border border-noir-600 text-ivory-100 text-xs focus:outline-none focus:border-gold-500"
            title={t('字号')}
          >
            {sizeOptions.map(s => (
              <option key={s} value={s}>
                {s}px{fontSize === null && s === presetFontPx ? t(' · 模板') : ''}
              </option>
            ))}
          </select>

          {/* === 字体（开源免费字体） === */}
          <select
            value={fontFamilyId}
            onChange={e => setFontFamilyId(e.target.value)}
            className="px-2 py-1.5 bg-noir-800 border border-noir-600 text-ivory-100 text-xs focus:outline-none focus:border-gold-500 max-w-[190px]"
            title={t('正文字体')}
          >
            {FONT_OPTIONS.map(f => (
              <option key={f.id || 'preset'} value={f.id}>{t(f.label)}</option>
            ))}
          </select>

          <div className="h-6 w-px bg-noir-700" />

          {/* === 对齐 === */}
          <div className="flex items-center gap-0.5">
            <ToolBtn icon={AlignLeft} title={t('左对齐')} onClick={() => applyAlign('left')} />
            <ToolBtn icon={AlignCenter} title={t('居中')} onClick={() => applyAlign('center')} />
            <ToolBtn icon={AlignRight} title={t('右对齐')} onClick={() => applyAlign('right')} />
          </div>

          <div className="h-6 w-px bg-noir-700" />

          {/* === 查找替换 === */}
          <button
            onClick={() => setShowFindReplace(!showFindReplace)}
            className={`px-2 py-1.5 border text-xs flex items-center gap-1 transition-colors ${
              showFindReplace ? 'border-gold-500 text-gold-400 bg-gold-500/10' : 'border-noir-600 text-ivory-300 hover:border-gold-500/50'
            }`}
            title={t('查找替换 (Ctrl+F)')}
          >
            <Search size={14} />
          </button>

          <div className="h-6 w-px bg-noir-700" />

          {/* === 助理（桌面陪伴女编剧） === */}
          <button
            onClick={() => setMuseVisible(v => !v)}
            className={`px-3 py-2 border text-xs flex items-center gap-1.5 transition-colors ${
              museVisible
                ? 'border-gold-500 text-gold-400 bg-gold-500/10'
                : 'border-noir-600 text-ivory-300 hover:border-gold-500/50 hover:text-gold-400'
            }`}
            title={museVisible ? t('收起助理（H 键）') : t('呼出助理（H 键）')}
          >
            <Sparkles size={13} />
            {t('助理')}
          </button>

          <div className="h-6 w-px bg-noir-700" />

          {/* === 分栏预览 === */}
          <div className="flex items-center gap-0.5" title={t('预览分栏')}>
            <Columns size={14} className="text-ivory-400 mr-1" />
            {[1,2,3].map(n => (
              <button
                key={n}
                onClick={() => setPreviewColumns(n)}
                className={`px-2 py-1 text-[10px] border ${
                  previewColumns === n
                    ? 'border-gold-500 text-gold-400 bg-gold-500/10'
                    : 'border-noir-600 text-ivory-400 hover:border-gold-500/50'
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          {/* === 自定义稿纸 === */}
          <div className="h-6 w-px bg-noir-700" />
          <button
            onClick={() => setShowPaperPicker(true)}
            className="px-2 py-1 text-[10px] border border-noir-600 text-ivory-400 hover:text-gold-400 hover:border-gold-500/50 flex items-center gap-1 transition-colors"
            title={t('自定义稿纸')}
          >
            <ImageIcon size={12} />
            {t('稿纸')}
          </button>

          {/* === 向上收纳工具栏 === */}
          <button
            onClick={() => setToolbarCollapsed(true)}
            className="ml-auto px-2 py-1.5 border border-noir-700 text-ivory-400 hover:text-gold-400 hover:border-gold-500/50 transition-colors"
            title={t('收起工具栏')}
          >
            <ChevronUp size={14} />
          </button>
        </div>

        {/* === 第二行：格式 / 文件操作 / 场景插入 / 面板开关 === */}
        <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap">
          {/* 格式选择 */}
          <div className="relative" ref={formatMenuRef}>
            <button
              onClick={() => { setFormatMenuOpen(!formatMenuOpen); setExportMenuOpen(false) }}
              className="px-4 py-2 border border-noir-600 hover:border-gold-500/50 text-sm font-medium flex items-center gap-2 transition-colors text-ivory-100"
            >
              <Settings size={16} />
              {format.name}
              <ChevronDown size={14} />
            </button>

            {formatMenuOpen && (
              <div className="menu-noir animate-fade-in absolute top-full left-0 mt-1 w-72 py-2 z-50 max-h-96 overflow-y-auto">
                {FORMAT_PRESET_LIST.map(preset => {
                  const locked = !formatAllowed(plan, FORMAT_ACCESS, preset.id)
                  return (
                    <button
                      key={preset.id}
                      disabled={locked}
                      onClick={() => { if (!locked) handleFormatChange(preset.id) }}
                      className={`w-full text-left px-4 py-3 transition-colors border-b border-noir-700/50 ${
                        locked ? 'opacity-50 cursor-not-allowed hover:bg-transparent text-ivory-400' : 'hover:bg-noir-700/30 text-ivory-100'
                      } ${formatId === preset.id && !locked ? 'bg-noir-700/50' : ''}`}
                    >
                      <div className="font-medium text-sm flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          {preset.name}
                          {locked && <Lock size={12} className="text-ivory-400" />}
                        </span>
                        {!locked && formatId === preset.id && <Check size={14} className="text-gold-500" />}
                      </div>
                      <div className="text-xs text-ivory-400 mt-0.5">{preset.description}</div>
                      <div className="text-xs text-ivory-400 mt-1 flex items-center gap-2">
                        {t('字体: ')}{preset.font?.family || preset.font} {preset.font?.sizePt ? `${preset.font.sizePt}pt` : ''}
                        {locked && <span className="text-gold-500 lock-chip">{t('Pro 版专属')}</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* 已套用的剧作风格 → 打开风格库 */}
          {styleId && getStyleById(styleId) && (
            <button
              onClick={() => window.dispatchEvent(new Event('scriptforge:open-style'))}
              className="px-3 py-2 border border-gold-500/40 bg-gold-500/10 text-gold-400 text-xs flex items-center gap-2 hover:border-gold-500 transition-colors"
              title={t('打开剧作风格库')}
            >
              <Layers size={13} />
              {getStyleById(styleId).name}
            </button>
          )}

          {/* 导入 */}
          <label className="px-4 py-2 border border-noir-600 hover:border-gold-500/50 text-sm font-medium flex items-center gap-2 text-ivory-100 cursor-pointer transition-colors">
            <Upload size={16} />
            {t('导入')}
            <input
              type="file"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                e.target.value = ''
                handleImport(file)
              }}
              accept=".txt,.fountain,.fdx,.md,.markdown,.csv,.tsv,.json,.xml,.yml,.yaml,
                      .docx,.odt,.ods,.odp,.rtf,.html,.htm,.xhtml,.epub,
                      .doc,.log,.text,text/plain,text/html"
            />
          </label>

          {/* 当前剧本标题（可编辑，联动剧本架） */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-noir-800 border border-noir-600 min-w-[180px] max-w-[280px]">
            <FileText size={12} className="text-gold-500 flex-shrink-0" />
            <input
              value={scriptTitle}
              onChange={e => { setScriptTitle(e.target.value); scheduleSave(900) }}
              placeholder={t('未命名剧本')}
              className="flex-1 bg-transparent text-ivory-100 text-xs focus:outline-none min-w-0"
              title={t('剧本标题（自动保存到本地剧本文件夹）')}
            />
            {lastSavedAt && (
              <span
                className="text-[9px] uppercase tracking-wider text-gold-400 px-1 bg-gold-500/10 border border-gold-500/30 flex-shrink-0"
                title={t('自动保存于 {time}', { time: lastSavedAt.toLocaleString() })}
              >
                {lastSavedAt.toLocaleTimeString('zh-CN', { hour12: false })}
              </span>
            )}
          </div>

          {/* 导出 */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => { setExportMenuOpen(!exportMenuOpen); setFormatMenuOpen(false) }}
              className="px-4 py-2 bg-gold-500 hover:bg-gold-400 text-noir-900 text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Download size={16} />
              {t('导出')}
              <ChevronDown size={14} />
            </button>

            {exportMenuOpen && (
              <div className="menu-noir animate-fade-in absolute top-full left-0 mt-1 w-48 py-2 z-50">
                <ExportMenuItem label={t('PDF (专业排版)')} formatKey="pdf" plan={plan} onExport={handleExport} onClose={() => setExportMenuOpen(false)} />
                <ExportMenuItem label="Fountain (.fountain)" formatKey="fountain" plan={plan} onExport={handleExport} onClose={() => setExportMenuOpen(false)} />
                <ExportMenuItem label="Final Draft (.fdx)" formatKey="fdx" plan={plan} onExport={handleExport} onClose={() => setExportMenuOpen(false)} />
                <ExportMenuItem label="Word (.docx)" formatKey="docx" plan={plan} onExport={handleExport} onClose={() => setExportMenuOpen(false)} />
                <ExportMenuItem label="HTML (.html)" formatKey="html" plan={plan} onExport={handleExport} onClose={() => setExportMenuOpen(false)} />
              </div>
            )}
          </div>

          {/* 保存 */}
          <button
            onClick={handleSave}
            className={`btn-outline text-sm flex items-center gap-2 ${saved ? 'save-flash text-gold-500 border-gold-500/60' : ''}`}
          >
            {saved ? <Check size={16} /> : <Save size={16} />}
            {saved ? t('已保存') : t('保存')}
          </button>

          {/* 版本快照 */}
          <div className="relative" ref={historyRef}>
            <button
              onClick={toggleHistory}
              className="btn-outline text-sm flex items-center gap-2"
              title={t('查看 / 恢复历史版本')}
            >
              <Clock size={16} />
              {t('版本')}
            </button>
            {historyOpen && (
              <div className="menu-noir animate-fade-in absolute top-full right-0 mt-1 w-64 py-2 z-50 max-h-80 overflow-y-auto">
                <div className="px-3 pb-1 text-[10px] uppercase tracking-[0.2em] text-ivory-500">
                  {t('版本快照（{n}）', { n: versions.length })}
                </div>
                {versions.length === 0 && (
                  <div className="px-3 py-2 text-xs text-ivory-500">{t('还没有快照，点「保存」即可生成')}</div>
                )}
                {versions.map(v => (
                  <button
                    key={v.id}
                    onClick={() => restoreVersion(v)}
                    className="w-full text-left px-3 py-2 text-xs text-ivory-200 hover:bg-noir-700/60"
                  >
                    <div>{new Date(v.createdAt).toLocaleString('zh-CN', { hour12: false })}</div>
                    <div className="text-[10px] text-ivory-500 mt-0.5">
                      {t('{n} 字符 · {format}', { n: v.text.length, format: getPresetById(v.formatId)?.name || v.formatId })}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-noir-700 mx-1" />

          {/* 快捷插入 —— 场景 / 角色 / 括号 / 转场（同一行） */}
          <button onClick={insertScene} className="px-3 py-2 text-[11px] uppercase tracking-[0.15em] text-ivory-400 hover:text-gold-500 border border-noir-700 hover:border-gold-500/50">
            {t('场景')} <span className="opacity-40 ml-1">⏎</span>
          </button>
          <button onClick={insertCharacter} className="px-3 py-2 text-[11px] uppercase tracking-[0.15em] text-ivory-400 hover:text-gold-500 border border-noir-700 hover:border-gold-500/50">
            {t('角色')}
          </button>
          <button onClick={insertAction} className="px-3 py-2 text-[11px] uppercase tracking-[0.15em] text-ivory-400 hover:text-gold-500 border border-noir-700 hover:border-gold-500/50">
            {t('括号')}
          </button>
          <button onClick={insertTransition} className="px-3 py-2 text-[11px] uppercase tracking-[0.15em] text-ivory-400 hover:text-gold-500 border border-noir-700 hover:border-gold-500/50">
            {t('转场')}
          </button>

          <div className="h-6 w-px bg-noir-700 mx-1" />

          <button onClick={loadExample} className="px-3 py-2 text-[11px] uppercase tracking-[0.15em] text-gold-500 border border-noir-700 hover:border-gold-500/50">
            {t('加载示例')}
          </button>
          <button onClick={loadSaved} className="px-3 py-2 text-[11px] uppercase tracking-[0.15em] text-ivory-400 hover:text-gold-500 border border-noir-700 hover:border-gold-500/50">
            {t('加载上次')}
          </button>

          <div className="flex-1" />

          {/* 面板切换 —— 预览独立，校验/统计互斥（底部抽屉）*/}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`px-3 py-2 text-[11px] uppercase tracking-[0.15em] flex items-center gap-1 border ${
                showPreview ? 'border-gold-500 text-gold-500' : 'border-noir-700 text-ivory-400 hover:text-gold-500 hover:border-gold-500/50'
              }`}
            >
              {showPreview ? <Eye size={12} /> : <EyeOff size={12} />}
              {t('预览')}
            </button>
            <button
              onClick={() => setBottomPanel(bottomPanel === 'validate' ? 'none' : 'validate')}
              className={`px-3 py-2 text-[11px] uppercase tracking-[0.15em] flex items-center gap-1 border ${
                bottomPanel === 'validate' ? 'border-red-500 text-red-400' : 'border-noir-700 text-ivory-400 hover:text-red-400 hover:border-red-500/50'
              }`}
            >
              <AlertTriangle size={12} />
              {t('校验')}
            </button>
            <button
              onClick={() => setBottomPanel(bottomPanel === 'stats' ? 'none' : 'stats')}
              className={`px-3 py-2 text-[11px] uppercase tracking-[0.15em] flex items-center gap-1 border ${
                bottomPanel === 'stats' ? 'border-gold-500 text-gold-500' : 'border-noir-700 text-ivory-400 hover:text-gold-500 hover:border-gold-500/50'
              }`}
            >
              <FileText size={12} />
              {t('统计')}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* 主编辑区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧构箱栏（可开关） */}
        {showWorkspace && (
          <WorkspacePanel
            key={currentScriptId}
            scriptId={currentScriptId}
            onClose={() => setShowWorkspace(false)}
          />
        )}
        {/* 中间编辑区 */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="px-4 py-2 border-b border-noir-700/50 bg-noir-900/35 backdrop-blur-sm text-sm font-medium flex items-center gap-2 text-ivory-100">
            <Wand2 size={14} className="text-gold-500" />
            {t('编辑器 ({name})', { name: format.name })}
            {pagination && (
              <span className="text-[10px] tracking-[0.15em] text-ivory-500 tabular-nums">
                {t('· 共 {n} 页', { n: pagination.totalPages })}
                {pagination.totalPages > 1 && t('· {n} 处对白跨页', { n: pagination.pages.filter(p => p.continued).length })}
              </span>
            )}
          </div>
          {/* 编辑区：项目栏与纸面同处一块面板，左侧贴合、顶部让出编辑器页眉 */}
          <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* 左侧半透明项目栏：视图 / 环境 / 归档 / 新建项目 */}
          <ProjectRail
            currentId={currentScriptId}
            env={{
              formatId,
              formatName: format.name,
              styleName: getStyleById(styleId)?.name || getStyleById(styleId)?.title || '',
              chars: text.length,
              pages: pagination?.totalPages,
              savedAt: lastSavedAt,
            }}
            collapsed={railCollapsed}
            onToggle={() => setRailCollapsed(v => !v)}
          />
          <div
            className="flex-1 min-w-0 overflow-auto editor-scroll"
            style={{
              padding: '26px 0',
              // 右侧补偿与项目栏等宽，纸面始终相对整块编辑区居中，不因项目栏右移
              paddingRight: railCollapsed ? 36 : 224,
            }}
          >
            <div
              className="relative mx-auto"
              style={{
                // 固定成模板纸张宽度：编辑区与预览的正文宽度一致，
                // 分页断点才能逐像素对齐；窗口更窄时由外层横向滚动。
                width: pageMetrics(format).pageW,
                minWidth: pageMetrics(format).pageW,
                minHeight: '100%',
              }}
            >
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={e => { setText(e.currentTarget.innerText); scheduleSave() }}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                data-placeholder={t('在这里开始写作...\n使用 Fountain 风格语法:\n  INT. 咖啡馆 - 白天    (场景标题)\n  角色名                 (全大写)\n  (动作描述)            (括号注释)\n  对话内容              (对话)')}
                className="w-full focus:outline-none editor-noir editor-script"
                style={{
                  // 页面度量（字体/字号/行距/页边距/页宽）与预览共用 formatStyle 的同一份数据
                  ...getPageStyle(format),
                  fontFamily: fontFamily || undefined,
                  fontSize: (fontSize ?? presetFontPx) + 'px',
                  minHeight: '100%',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  // 分栏（直接作用于编辑器）
                  ...(previewColumns > 1 ? {
                    columnCount: previewColumns,
                    columnGap: '2.5rem',
                    columnRule: '1px solid rgba(201,168,76,0.2)',
                  } : {}),
                  // 稿纸背景（paperVersion 变化时从 localStorage 读）
                  ...(() => {
                    const paper = getActivePaper()
                    const bg = paperToBackgroundCss(paper)
                    const isPlain = !bg || (paper && paper.id === 'builtin-plain')
                    // 纯米白稿纸：保持 backdrop-blur 让底下壁纸透上来
                    // 有纹理/图的稿纸：去掉 backdrop-blur 避免模糊纹理
                    const backdrop = isPlain
                      ? { backdropFilter: 'blur(14px) saturate(1.05)', WebkitBackdropFilter: 'blur(14px) saturate(1.05)' }
                      : { backdropFilter: 'none', WebkitBackdropFilter: 'none' }
                    if (!bg) return { backgroundColor: '#E8E2D5', ...backdrop }
                    if (bg.includes('gradient')) {
                      return { backgroundImage: bg, backgroundColor: paper.backgroundColor || '#E8E2D5', backgroundSize: 'cover', backgroundPosition: 'center', ...backdrop }
                    }
                    if (bg.startsWith('data:') || bg.startsWith('http')) {
                      return { backgroundImage: `url(${bg})`, backgroundColor: paper.backgroundColor || '#E8E2D5', backgroundSize: 'cover', backgroundPosition: 'center', ...backdrop }
                    }
                    return { backgroundColor: bg, ...backdrop }
                  })(),
                }}
                spellCheck={false}
              />
              {pagination && previewColumns === 1 && (
                <div
                  className="pointer-events-none absolute"
                  style={{
                    top: pageMetrics(format).top,
                    left: pageMetrics(format).left,
                    right: pageMetrics(format).right,
                    bottom: 0,
                    overflow: 'hidden',
                  }}
                >
                  {pagination.pages.slice(0, -1).map(page => (
                    <div
                      key={page.number}
                      data-break-y={Math.round(page.end)}
                      className="absolute left-0 right-0 border-t border-dashed border-gold-500/50"
                      style={{ top: page.end }}
                    >
                      <span className="absolute right-0 -top-4 text-[9px] tracking-[0.15em] text-gold-500/80 bg-noir-900/70 px-1">
                        {t('第 {n} 页', { n: page.number + 1 })}
                      </span>
                      {page.continued && (
                        <span className="absolute right-0 -top-4 mr-16 text-[9px] tracking-[0.2em] text-ivory-400">
                          MORE
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          </div>
        </div>

        {/* 预览（浮动小窗：可拖动、整体自适应、右下角可缩放） */}
        {showPreview && (
          <div
            ref={previewFloatRef}
            className="preview-float"
            style={{ left: previewPos.x, top: previewPos.y }}
          >
            <div className="preview-float-head" onPointerDown={startPreviewDrag}>
              <span className="preview-grip" />
              <Eye size={14} className="text-gold-500" />
              <span className="text-sm font-medium text-ivory-100">{t('预览')}</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-gold-500/70">{format.name}</span>
              <div className="flex-1" />
              <span className="text-[10px] tracking-[0.15em] text-ivory-500 tabular-nums">
                {pagination ? t('{n} 页 · ', { n: pagination.totalPages }) : ''}
                {t('{scenes} 场 · {paras} 段', { scenes: elements.filter(el => el.type === 'slugline').length, paras: elements.length })}
              </span>
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={() => setShowPreview(false)}
                className="ml-1 p-1 text-ivory-500 hover:text-ivory-100"
                title={t('关闭预览')}
              >
                <XIcon size={13} />
              </button>
            </div>

            <div className={`preview-stage--fit${previewZoom ? ' is-zoomed' : ''}`} ref={previewStageRef} onPointerDown={startPreviewPan} style={{ overflow: 'auto' }}>
              <div className="preview-sheet-frame">
                  {!pagination && (
                    <div style={{ width: 240, padding: '48px 28px', textAlign: 'center', color: '#8d8579', fontSize: 12, lineHeight: 1.9 }}>
                      {t('还没有可预览的内容')}
                      <br />
                      {t('在左侧输入剧本后按模板分页')}
                    </div>
                  )}
                  {pagination && (() => {
                    const m = pageMetrics(format)
                    const pageFont = {
                      fontFamily: fontFamily || getPageStyle(format).fontFamily,
                      fontSize: (fontSize ?? presetFontPx) + 'px',
                      lineHeight: getPageStyle(format).lineHeight,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }
                    const pad = getPageStyle(format)
                    const page = pagination.pages[Math.min(previewPage, pagination.totalPages) - 1]
                    if (!page) return null
                    return (
                      <div
                        className="preview-scaled"
                        style={{
                          width: m.pageW * previewScale,
                          height: m.pageH * previewScale,
                        }}
                      >
                        <div
                          className="preview-page-transform"
                          style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left', width: m.pageW }}
                        >
                          <div
                            ref={previewPageRef}
                            data-page={page.number}
                            data-start-y={Math.round(page.start)}
                            className="preview-page-sheet editor-script"
                            style={{
                              position: 'relative',
                              width: m.pageW,
                              height: m.pageH,
                              boxSizing: 'border-box',
                              paddingTop: pad.paddingTop,
                              paddingBottom: pad.paddingBottom,
                              paddingLeft: pad.paddingLeft,
                              paddingRight: pad.paddingRight,
                              background: '#f5f0e4',
                              boxShadow: '0 12px 30px rgba(0,0,0,.35)',
                              overflow: 'hidden',
                              ...pageFont,
                            }}
                          >
                            <div
                              style={{
                                width: m.contentW,
                                height: m.contentH,
                                overflow: 'hidden',
                                position: 'relative',
                              }}
                            >
                              <div
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  width: m.contentW,
                                  transform: `translateY(${-page.start}px)`,
                                  ...pageFont,
                                }}
                                dangerouslySetInnerHTML={{ __html: pagination.html }}
                              />
                            </div>

                            {format.pageNumber?.hideFirstPage !== false && page.number === 1 ? null : (
                              <div
                                className="preview-page-number"
                                style={{
                                  position: 'absolute',
                                  top: '0.5in',
                                  right: m.right,
                                  fontSize: '11pt',
                                  letterSpacing: '0.08em',
                                  color: '#3b3b46',
                                }}
                              >
                                {page.number}
                              </div>
                            )}

                            {page.continued && (
                              <div
                                className="preview-more"
                                style={{ position: 'absolute', right: m.right, bottom: m.bottom, fontSize: '10pt', letterSpacing: '0.12em', color: '#3b3b46' }}
                              >
                                MORE
                              </div>
                            )}
                            {page.contd && (
                              <div
                                className="preview-contd"
                                style={{ position: 'absolute', left: m.left, top: m.top, fontSize: '10pt', letterSpacing: '0.12em', color: '#3b3b46' }}
                              >
                                (CONT'D)
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })()}
              </div>
            </div>

            <div className="preview-float-foot">
              <span>{t('拖动标题栏移动 · 滚轮放大')}</span>
              {pagination && (
                <div className="flex items-center gap-1.5">
                  <button
                    className="preview-zoom disabled:opacity-30"
                    onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                    disabled={previewPage <= 1}
                    title={t('上一页')}
                  >
                    ‹
                  </button>
                  <span className="text-[9px] tracking-[0.14em] text-ivory-400 tabular-nums">
                    {Math.min(previewPage, pagination.totalPages)} / {pagination.totalPages}
                  </span>
                  <button
                    className="preview-zoom disabled:opacity-30"
                    onClick={() => setPreviewPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={previewPage >= pagination.totalPages}
                    title={t('下一页')}
                  >
                    ›
                  </button>
                </div>
              )}
              <button
                className="preview-zoom"
                onClick={() => setPreviewZoom(null)}
                title={t('点击恢复单页自适应')}
              >
                {Math.round(previewScale * 100)}%
              </button>
            </div>
          </div>
        )}

        {/* 查找替换浮动面板 */}
        {showFindReplace && (
          <div className="absolute top-20 right-6 z-40 w-80 bg-noir-800 border border-gold-500/50 shadow-xl p-3 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-[0.2em] text-gold-400 flex items-center gap-1">
                <Search size={12} /> {t('查找替换')}
              </span>
              <button onClick={() => setShowFindReplace(false)} className="text-ivory-500 hover:text-ivory-200">
                <XIcon size={14} />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <input
                value={findText}
                onChange={e => setFindText(e.target.value)}
                placeholder={t('查找...')}
                className="flex-1 bg-noir-900 border border-noir-700 text-ivory-100 text-xs px-2 py-1.5 focus:outline-none focus:border-gold-500"
              />
              <span className="text-[10px] text-ivory-400 px-1 whitespace-nowrap">
                {findText ? t('{n} 处', { n: findMatches.length }) : ''}
              </span>
            </div>
            <input
              value={replaceText}
              onChange={e => setReplaceText(e.target.value)}
              placeholder={t('替换为...')}
              className="w-full bg-noir-900 border border-noir-700 text-ivory-100 text-xs px-2 py-1.5 focus:outline-none focus:border-gold-500"
            />
            <label className="flex items-center gap-1.5 text-[11px] text-ivory-300 cursor-pointer">
              <input
                type="checkbox"
                checked={findCaseSensitive}
                onChange={e => setFindCaseSensitive(e.target.checked)}
                className="w-3 h-3"
              />
              {t('区分大小写')}
            </label>
            <div className="flex gap-1.5 pt-1">
              <button
                onClick={replaceNext}
                disabled={!findText || findMatches.length === 0}
                className="flex-1 px-2 py-1 bg-noir-700 hover:bg-noir-600 text-ivory-100 text-[11px] disabled:opacity-40 flex items-center justify-center gap-1"
              >
                <Replace size={11} /> {t('替换下一个')}
              </button>
              <button
                onClick={replaceAll}
                disabled={!findText || findMatches.length === 0}
                className="flex-1 px-2 py-1 bg-gold-500 hover:bg-gold-400 text-noir-900 text-[11px] font-medium disabled:opacity-40"
              >
                {t('全部替换')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 底部面板：校验 / 统计（二选一，可开关） */}
      {(showValidation || showStats) && (
        <div className="bg-noir-800 border-t border-noir-700 max-h-64 overflow-hidden flex flex-col">
          {/* tab 切换条 */}
          <div className="flex items-center border-b border-noir-700 text-[11px] uppercase tracking-[0.15em]">
            <button
              onClick={() => setBottomPanel('validate')}
              className={`px-4 py-2 flex items-center gap-1 border-b-2 transition-colors ${
                showValidation ? 'border-red-500 text-red-400 bg-noir-700/30' : 'border-transparent text-ivory-400 hover:text-ivory-200'
              }`}
            >
              <AlertTriangle size={11} />
              {t('校验')} · {validation.critical.length}×err {validation.warnings.length}×warn
              {validation.structural.length > 0 && ` ${validation.structural.length}×${t('结构')}`}
            </button>
            <button
              onClick={() => setBottomPanel('stats')}
              className={`px-4 py-2 flex items-center gap-1 border-b-2 transition-colors ${
                showStats ? 'border-gold-500 text-gold-500 bg-noir-700/30' : 'border-transparent text-ivory-400 hover:text-ivory-200'
              }`}
            >
              <FileText size={11} />
              {t('统计')}
            </button>
            <div className="flex-1" />
            {showValidation && (
              <button
                onClick={handleAutoFix}
                className="px-3 py-2 text-gold-400 hover:text-gold-300 flex items-center gap-1 transition-colors"
                title={t('统一角色名、清理空段落与多余空格')}
              >
                <Wand2 size={11} /> {t('一键修复')}
              </button>
            )}
            <button
              onClick={() => setBottomPanel('none')}
              className="px-3 py-2 text-ivory-500 hover:text-ivory-200 transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {showValidation && (
              (validation.critical.length + validation.warnings.length + validation.structural.length + validation.suggestions.length) === 0 ? (
                <div className="text-center py-4 text-ivory-400">
                  <Check size={24} className="mx-auto mb-1 text-green-500" />
                  <p className="text-sm">{t('格式检查通过！')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    { key: 'critical', title: '严重错误', tone: 'red', items: validation.critical },
                    { key: 'warnings', title: '格式警告', tone: 'gold', items: validation.warnings },
                    { key: 'structural', title: '结构问题', tone: 'violet', items: validation.structural },
                    { key: 'suggestions', title: '优化建议', tone: 'ivory', items: validation.suggestions },
                  ].map(group => group.items.length === 0 ? null : (
                    <div key={group.key}>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-ivory-400 mb-1.5">
                        {t(group.title)} · {group.items.length}
                      </div>
                      <div className="space-y-1.5">
                        {group.items.map(item => {
                          const tone = group.tone
                          const border = tone === 'red' ? 'border-red-500/40' : tone === 'gold' ? 'border-gold-500/40' : tone === 'violet' ? 'border-violet-400/40' : 'border-noir-600'
                          const text = tone === 'red' ? 'text-red-200' : tone === 'gold' ? 'text-amber-300' : tone === 'violet' ? 'text-violet-200' : 'text-ivory-300'
                          const mark = tone === 'red' ? '✕' : tone === 'gold' ? '⚠' : tone === 'violet' ? '◆' : '·'
                          return (
                            <div key={item.id} className={`flex items-start gap-2 p-2 border ${border} text-sm`}>
                              <span className={`${text} mt-0.5`}>{mark}</span>
                              <div className="min-w-0">
                                <div className={text}>{item.message}</div>
                                {item.hint && <div className="text-xs text-ivory-400 mt-0.5">{item.hint}</div>}
                                {item.element?.text && (
                                  <div className="text-xs text-ivory-500 mt-0.5 italic truncate">
                                    "{String(item.element.text).slice(0, 60)}"
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {showStats && (
              <div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
                  <StatCard label={t('场景')} value={stats.scenes || 0} />
                  <StatCard label={t('角色')} value={stats.characters || 0} />
                  <StatCard label={t('对话')} value={stats.dialogueLines || 0} />
                  <StatCard label={t('页数')} value={stats.estimatedPages || 1} />
                  <StatCard label={t('时长')} value={stats.estimatedMinutes ? t('{n}分', { n: stats.estimatedMinutes }) : '-'} />
                  <StatCard label={t('动作')} value={stats.actionChars || stats.actionWords || 0} />
                </div>

                {/* 对白 / 动作占比 */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-ivory-400 mb-1">
                    <span>{t('对白 / 动作占比')}</span>
                    <span>{t('{n}% 对白', { n: Math.round((stats.dialogueRatio || 0) * 100) })}</span>
                  </div>
                  <div className="h-2 flex bg-noir-700 overflow-hidden">
                    <div className="h-full bg-gold-500" style={{ width: `${Math.round((stats.dialogueRatio || 0) * 100)}%` }} />
                    <div className="h-full flex-1 bg-emerald-500/70" />
                  </div>
                  <div className="flex justify-between text-[10px] text-ivory-500 mt-1">
                    <span>{t('对白 {n} 字', { n: stats.dialogueChars || 0 })}</span>
                    <span>{t('动作 {n} 字', { n: stats.actionChars || 0 })}</span>
                  </div>
                </div>

                {stats.characterStats?.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-ivory-400 mb-2 flex items-center gap-1">
                      <Users size={12} />
                      {t('台词量分布')}
                    </div>
                    <div className="space-y-1.5">
                      {stats.characterStats.slice(0, 8).map(item => (
                        <div key={item.name} className="flex items-center gap-2 text-xs">
                          <span className="w-20 truncate text-ivory-200">{item.name}</span>
                          <div className="flex-1 h-1.5 bg-noir-700 overflow-hidden">
                            <div className="h-full bg-gold-500/70" style={{ width: `${Math.round(item.ratio * 100)}%` }} />
                          </div>
                          <span className="w-24 text-right text-ivory-400">
                            {t('{n} 字 · {pct}%', { n: item.chars, pct: Math.round(item.ratio * 100) })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 句长与独白 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="border border-noir-600 p-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-gold-400 mb-1">{t('平均句长')}</div>
                    <div className="text-lg text-ivory-100">
                      {stats.avgSentenceLength || 0}
                      <span className="text-xs text-ivory-400 ml-1">{t('字 / 句')}</span>
                    </div>
                    <p className="text-[10px] text-ivory-500 mt-1">{t('中文对白一般 8–15 字；过长可考虑拆分。')}</p>
                  </div>
                  <div className="border border-noir-600 p-2 min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-gold-400 mb-1">
                      {t('最长独白 · {name}', { name: stats.longestMonologue?.character || '—' })}
                    </div>
                    <p className="text-[11px] text-ivory-300 leading-snug italic break-words">
                      “{stats.longestMonologue?.text?.slice(0, 120) || t('暂无对白')}”
                    </p>
                    <div className="text-[10px] text-ivory-500 mt-1">{t('{n} 字', { n: stats.longestMonologue?.chars || 0 })}</div>
                  </div>
                </div>

                {stats.characterList?.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs text-ivory-400 mb-2 flex items-center gap-1">
                      <Users size={12} />
                      {t('角色列表（{n}）', { n: stats.characterList.length })}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {stats.characterList.map((char, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-noir-700 text-ivory-200 text-xs font-mono">
                          {char}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 导入确认：先选稿件用途（转换目标规范），再解析排版 */}
      {importQueue && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-6"
          onClick={() => { if (!importBusy) setImportQueue(null) }}
        >
          <div
            className="w-full max-w-2xl bg-noir-800 border border-gold-500/40 shadow-2xl animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-noir-700 flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-gold-500 mb-1">{t('Import · 结构识别')}</div>
                <h3 className="text-ivory-100 text-base font-medium">{t('这份稿子要用在哪？')}</h3>
                <p className="text-xs text-ivory-400 mt-1">
                  {t('先解析文档结构（场景 / 角色 / 对白 / 动作），再按选择的规范重新排版。')}
                </p>
              </div>
              <button
                onClick={() => { if (!importBusy) setImportQueue(null) }}
                className="text-ivory-500 hover:text-ivory-100 p-1"
                title={t('取消')}
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[56vh] overflow-y-auto">
              {IMPORT_PURPOSES.map(item => {
                const locked = !formatAllowed(plan, FORMAT_ACCESS, item.id)
                const active = importPurpose === item.id && !locked
                return (
                  <button
                    key={item.id}
                    disabled={locked || importBusy}
                    onClick={() => setImportPurpose(item.id)}
                    className={`text-left px-3 py-2.5 border transition-colors ${
                      active
                        ? 'border-gold-500 bg-gold-500/10'
                        : 'border-noir-600 hover:border-gold-500/40'
                    } ${locked ? 'opacity-45 cursor-not-allowed' : ''}`}
                  >
                    <div className="text-sm text-ivory-100 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        {t(item.label)}
                        {locked && <Lock size={11} className="text-ivory-400" />}
                      </span>
                      {active && <Check size={13} className="text-gold-500" />}
                    </div>
                    <div className="text-[11px] text-ivory-400 mt-0.5">{t(item.desc)}</div>
                  </button>
                )
              })}
            </div>

            <div className="px-5 py-3 border-t border-noir-700 flex items-center gap-3">
              <span className="text-xs text-ivory-500 truncate flex-1" title={importQueue.file?.name}>
                {importQueue.file?.name}
              </span>
              <button
                onClick={() => setImportQueue(null)}
                disabled={importBusy}
                className="btn-outline text-sm px-4 py-1.5"
              >
                {t('取消')}
              </button>
              <button
                onClick={confirmImport}
                disabled={importBusy}
                className="px-5 py-1.5 bg-gold-500 hover:bg-gold-400 text-noir-900 text-sm font-medium disabled:opacity-50"
              >
                {importBusy ? t('正在解析…') : t('开始导入')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 斧头 · 编剧老师（桌面陪伴） */}
      <CharacterMuse text={text} visible={museVisible} onVisibleChange={setMuseVisible} />

      {/* 自定义稿纸面板 */}
      {showPaperPicker && (
        <PaperPicker
          onClose={() => setShowPaperPicker(false)}
          onChange={() => setPaperVersion(v => v + 1)}
        />
      )}
    </div>
  )
}

function ScriptElement({ element, format }) {
  if (!element.text && element.type !== 'pagebreak' && !element.dual) return null
  const text = element.text
  const clsMap = {
    slugline: 'slugline',
    action: 'action',
    character: 'character',
    parenthetical: 'parenthetical',
    dialogue: 'dialogue',
    transition: 'transition',
    teaser: 'teaser',
    act: 'act',
    endact: 'endact',
    shot: 'shot',
    subheading: 'subheading',
    note: 'text-gray-500 italic text-sm',
  }

  // 双人对话：左右两栏
  if (element.type === 'dualdialogue' && element.dual) {
    const upper = format.character?.uppercase !== false
    return (
      <div className="dualdialogue">
        {[element.dual.left, element.dual.right].map((part, index) => (
          <div className="dual-col" key={index}>
            <RichText text={upper ? part.name.toUpperCase() : part.name} className="dual-name" />
            {part.lines.map((line, i) => (
              <RichText
                key={i}
                text={line.text}
                className={line.type === 'parenthetical' ? 'dual-parenthetical' : 'dual-line'}
              />
            ))}
          </div>
        ))}
      </div>
    )
  }

  // 中文格式：元素样式同样来自 formatStyle（indentEm / 居中等）
  if (format.id === 'cn-gov') {
    if (element.type === 'pagebreak') return <div className="page-break" />
    const cnCls = clsMap[element.type] || 'action'
    return <RichText text={text} className={cnCls} style={getElementStyle(format, element.type)} />
  }

  // 全大写处理
  let displayText = text
  if (element.type === 'slugline' && format.slugline?.uppercase) displayText = text.toUpperCase()
  if (element.type === 'character' && format.character?.uppercase !== false) displayText = text.toUpperCase()
  if (['teaser', 'act', 'endact', 'shot'].includes(element.type)) displayText = text.toUpperCase()

  const cls = clsMap[element.type] || 'action'

  if (element.type === 'pagebreak') return <hr className="my-8 border-dashed" />

  return <RichText text={displayText} className={cls} style={getElementStyle(format, element.type)} />
}

// ============ 富文本渲染器：把 markdown-like 标记转成 HTML ============
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function markupToHtml(raw) {
  let html = escapeHtml(raw)
  // 顺序很重要：先处理双字符标记（**、__、~~、==），再处理单字符（*）
  html = html.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__([^_]+?)__/g, '<u>$1</u>')
  html = html.replace(/~~([^~]+?)~~/g, '<s>$1</s>')
  html = html.replace(/==([^=]+?)==/g, '<mark style="background:rgba(201,168,76,0.4);color:inherit;padding:0 2px;">$1</mark>')
  // 字号 {size=N}...{/size}
  html = html.replace(/\{size=(\d+)\}([\s\S]+?)\{\/size\}/g, '<span style="font-size:$1px">$2</span>')
  // 颜色 {red}...{/red} 等
  const colorMap = {
    red: '#F87171', gold: '#C9A84C', green: '#34D399',
    blue: '#60A5FA', purple: '#A78BFA', orange: '#FB923C',
  }
  html = html.replace(/\{(red|gold|green|blue|purple|orange)\}([\s\S]+?)\{\/\1\}/g, (m, c, content) =>
    `<span style="color:${colorMap[c]}">${content}</span>`
  )
  // 斜体 *...* （最后处理，避免吃掉 **）
  html = html.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')
  return html
}

function RichText({ text, className = '', style }) {
  // 行首对齐标记
  const alignMatch = text.match(/^\{align=(left|center|right)\}/)
  const align = alignMatch ? alignMatch[1] : null
  const cleanText = alignMatch ? text.slice(alignMatch[0].length) : text
  const html = markupToHtml(cleanText)
  const mergedStyle = align ? { ...style, textAlign: align } : style
  return (
    <div
      className={className}
      style={mergedStyle}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ============ 工具栏小按钮 ============
function ToolBtn({ icon: Icon, title, onClick, disabled, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 border transition-colors ${
        active
          ? 'border-gold-500 text-gold-400 bg-gold-500/10'
          : 'border-noir-600 text-ivory-300 hover:border-gold-500/50 hover:text-gold-400'
      } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
      <Icon size={14} />
    </button>
  )
}

function StatCard({ icon, label, value }) {
  return (
    <div className="border border-noir-600 text-center p-6">
      <div className="headline text-2xl text-gold-500">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-ivory-400 mt-0.5">{label}</div>
    </div>
  )
}

// 带权限检查的导出菜单项
function ExportMenuItem({ label, icon, formatKey, plan, onExport, onClose }) {
  const locked = !exportAllowed(plan, EXPORT_ACCESS, formatKey)
  return (
    <button
      disabled={locked}
      onClick={() => { if (!locked) { onExport(formatKey); onClose() } }}
      className={`w-full text-left px-4 py-2 text-[11px] uppercase tracking-[0.15em] flex items-center justify-between transition-colors border-b border-noir-700/50 ${
        locked
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:bg-noir-700/30 text-ivory-100'
      }`}
      title={locked ? UPGRADE_HINT[plan] : ''}
    >
      <span>{label}</span>
      {locked && <span className="lock-chip"><Lock size={10} /> Pro</span>}
    </button>
  )
}

