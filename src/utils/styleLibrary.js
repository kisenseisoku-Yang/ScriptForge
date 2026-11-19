// 剧作风格库 —— 数据来自规格文档文末 JSON（src/data/styleLibrary.json，由脚本提取，未手抄）
//
// 校验等级（不可改）：
//   A：仅 us_ 开头的美国商业风格（Syd Field 三幕 / 救猫咪 15 拍）→ 可做硬校验
//   B/C：韩国、日本的商业风格 → 半编码，只给提示与建议，不判错
//   D：文艺/作者线 → 关闭节点缺失校验，只保留阶段区间与倾向描述
//
// 「序破急」「起承转合」不在任何默认结构或校验规则中，只在页面里作为
// 可选注释展示，并明确标注「无量化依据」。

import raw from '../data/styleLibraryData.js'
import { parseScriptText } from './scriptParser.js'

export const STYLE_DATA = raw
export const STYLES = raw.styles

export const LEVEL_INFO = {
  A: { key: 'A', label: 'A 级 · 可硬校验', color: 'gold', desc: '美国商业风格，有公开的页锚点/拍点规范，可判定节点缺失、越界与阶段错位' },
  B: { key: 'B', label: 'B 级 · 半编码', color: 'violet', desc: '有从业者著作或教学支撑，位置存在分歧，只提示不建议判错' },
  C: { key: 'C', label: 'C 级 · 共识归纳', color: 'blue', desc: '播出形态可查、逐拍无公开规范，仅作建议' },
  D: { key: 'D', label: 'D 级 · 推断', color: 'ivory', desc: '文艺/作者线，反规范为方法；关闭节点缺失校验，只保留阶段区间与倾向' },
}

export function getStyleById(id) {
  return STYLES.find(s => s.id === id) || null
}

/** 只有 us_ 开头且标 A 的美国商业风格允许硬校验 */
export function isHardCheck(style) {
  return !!style && style.level === 'A' && String(style.id).startsWith('us_')
}

/** 是否有节点缺失校验（D 级一律关闭） */
export function nodeChecksEnabled(style) {
  return !!style && style.level !== 'D'
}

/** 剧集总集数：优先取用户输入，否则从 baseline/name 里读 */
export function defaultEpisodeCount(style) {
  if (!style) return 1
  const text = `${style.name} ${style.baseline || ''}`
  const mini = style.id.match(/mini(\d+)/)
  if (mini) return Number(mini[1])
  const m = text.match(/(\d+)\s*[集话話]/)
  if (m) return Number(m[1])
  const range = text.match(/(\d+)\s*[–-]\s*(\d+)/)
  if (range) return Number(range[1])
  return 1
}

/** 集号 = floor(pct/100 × N) + 1（规格文档口径） */
export function episodeFor(pct, total) {
  const n = Math.max(1, Number(total) || 1)
  const p = Math.min(100, Math.max(0, Number(pct) || 0))
  return Math.min(n, Math.floor((p / 100) * n) + 1)
}

const SLUG_TYPES = new Set(['slugline'])
const BOUNDARY_TYPES = new Set(['slugline', 'act', 'teaser', 'endact'])

/**
 * 把剧本正文映射到百分比坐标。
 * 以元素文本长度累计，场景边界（场景头/幕/teaser）作为结构事件锚点。
 */
export function buildScriptMap(text, formatId) {
  const source = String(text || '')
  if (!source.trim()) {
    return { totalChars: 0, sceneCount: 0, elements: [], boundaries: [] }
  }
  const elements = parseScriptText(source, formatId)
  const weights = elements.map(el => Math.max(1, String(el.text || '').length))
  const totalChars = weights.reduce((a, b) => a + b, 0) || 1

  const boundaries = []
  let acc = 0
  let sceneNo = 0
  elements.forEach((el, i) => {
    const start = (acc / totalChars) * 100
    const end = ((acc + weights[i]) / totalChars) * 100
    if (SLUG_TYPES.has(el.type)) sceneNo += 1
    if (BOUNDARY_TYPES.has(el.type)) {
      boundaries.push({
        index: i,
        type: el.type,
        sceneNo: SLUG_TYPES.has(el.type) ? sceneNo : 0,
        text: String(el.text || '').trim(),
        start,
        end,
      })
    }
    acc += weights[i]
  })

  return {
    totalChars,
    sceneCount: elements.filter(el => el.type === 'slugline').length,
    elements,
    boundaries,
  }
}

function stageFor(style, pct) {
  const stages = style.stages || []
  for (let i = 0; i < stages.length; i++) {
    const st = stages[i]
    if (pct >= st.start && (pct < st.end || (i === stages.length - 1 && pct <= st.end))) {
      return { ...st, index: i }
    }
  }
  return null
}

/** A 级风格的数据完整性检查：阶段缺口/重叠、节点越界、节点不在任何阶段 */
function validateStructure(style) {
  const issues = []
  const stages = style.stages || []
  stages.forEach((st, i) => {
    if (!(st.end > st.start)) {
      issues.push({ kind: 'stage', message: `阶段「${st.name}」区间无效：${st.start}% → ${st.end}%` })
    }
    if (i === 0 && st.start > 0) {
      issues.push({ kind: 'stage', message: `阶段「${st.name}」之前缺少 0–${st.start}% 的结构定义` })
    }
    if (i > 0 && Math.abs(st.start - stages[i - 1].end) > 0.01) {
      issues.push({ kind: 'stage', message: `阶段「${stages[i - 1].name}」与「${st.name}」之间存在缺口或重叠` })
    }
    if (i === stages.length - 1 && st.end < 100) {
      issues.push({ kind: 'stage', message: `阶段「${st.name}」之后缺少 ${st.end}–100% 的结构定义` })
    }
  })
  ;(style.nodes || []).forEach(node => {
    const [a, b] = node.pos || []
    if (!(a >= 0 && b <= 100 && b >= a)) {
      issues.push({ kind: 'node', message: `节点「${node.name}」越界：${a}% → ${b}%` })
      return
    }
    if (!stages.some(st => a >= st.start && b <= st.end)) {
      issues.push({ kind: 'node', message: `节点「${node.name}」（${a}–${b}%）不在任何单一阶段内，存在阶段错位` })
    }
  })
  return issues
}

/**
 * 核心分析
 * @param {object} style 风格条目
 * @param {string} text 剧本正文
 * @param {object} options { formatId, progressPct, episodeCount, parseScriptText }
 */
export function analyzeStyle(style, text, options = {}) {
  if (!style) return null
  const { formatId = 'hollywood', progressPct = 100, episodeCount } = options
  const totalEpisodes = Math.max(1, Number(episodeCount) || defaultEpisodeCount(style))
  const isSeries = (style.media || []).includes('剧集')
  const map = buildScriptMap(text, formatId)
  const progress = Math.min(100, Math.max(0, Number(progressPct) || 0))
  const stage = stageFor(style, progress)
  const hard = isHardCheck(style)
  const checksOn = nodeChecksEnabled(style)

  const structureIssues = hard ? validateStructure(style) : []

  const nodes = (style.nodes || []).map(node => {
    const [a, b] = node.pos || [0, 0]
    const evidence = map.boundaries.find(bd =>
      bd.start >= Math.max(0, a - 1) && bd.start <= Math.min(100, b + 1)
    )
    const passed = progress >= b
    let status = 'pending'
    let severity = 'none'
    let message = '尚未到达该节点区间'

    if (!checksOn) {
      status = 'info'
      severity = 'none'
      message = '文艺线 D 级：不做节点缺失校验，此处仅作倾向描述'
    } else if (evidence) {
      status = 'hit'
      message = `命中依据：${evidence.sceneNo ? `第 ${evidence.sceneNo} 场` : '结构标记'}「${evidence.text.slice(0, 28)}」位于 ${evidence.start.toFixed(1)}%`
    } else if (passed) {
      status = 'missing'
      severity = node.level && node.level !== 'A' ? 'warn' : (hard ? 'error' : 'warn')
      message = hard
        ? `缺失：${a}–${b}% 区间内没有检测到场景/结构事件`
        : `未检测到对应结构事件（${a}–${b}%）—— 仅提示，不判定为错误`
    }

    return {
      ...node,
      start: a,
      end: b,
      status,
      severity,
      message,
      episodeStart: isSeries ? episodeFor(a, totalEpisodes) : null,
      episodeEnd: isSeries ? episodeFor(b, totalEpisodes) : null,
    }
  })

  const counts = nodes.reduce((acc, n) => {
    acc[n.status] = (acc[n.status] || 0) + 1
    return acc
  }, {})

  return {
    style,
    level: style.level,
    hard,
    checksOn,
    progress,
    stage,
    totalEpisodes,
    isSeries,
    episode: isSeries ? episodeFor(progress, totalEpisodes) : null,
    stages: (style.stages || []).map(st => ({
      ...st,
      state: progress >= st.end ? 'past' : progress < st.start ? 'future' : 'current',
    })),
    nodes,
    structureIssues,
    counts: {
      hit: counts.hit || 0,
      missing: counts.missing || 0,
      error: nodes.filter(n => n.severity === 'error').length,
      warn: nodes.filter(n => n.severity === 'warn').length,
    },
    sceneCount: map.sceneCount,
  }
}

/** 「序破急」「起承转合」等存疑条目（只作可选注释，无量化依据） */
export function getDisputedNotes(keywords = ['序破急', '起承转合', '起承転結', '起承转結']) {
  return (raw.disputed || []).filter(item =>
    keywords.some(k => `${item.term} ${item.claim}`.includes(k))
  )
}
