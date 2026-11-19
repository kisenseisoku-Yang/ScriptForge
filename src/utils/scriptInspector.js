// 剧本格式检查器 —— 在 validateFormat 基础上扩展为四类报告
// critical / warning / structural / suggestion
import { ELEMENT_TYPES, validateFormat, parseSceneMeta } from './scriptParser.js'

const CN_TYPE = /内景|外景|内外景/
const EN_TYPE = /\b(INT\.?|EXT\.?|INT\.\/EXT\.?|I\/E)\b/i
const SCENE_NUM = /^\s*(?:sc|scene|场)?\s*\d+\s*[.、:：\-—]?\s*/i

export function normalizeCharName(value) {
  return String(value || '')
    .replace(/^【|】$/g, '')
    .replace(/[（(].*$/, '')
    .replace(/\s+/g, '')
    .replace(/[:：.。]$/, '')
    .toUpperCase()
}

function visibleLength(text) {
  return String(text || '').replace(/\s/g, '').length
}

function collectScenes(elements) {
  const scenes = []
  elements.forEach((el, index) => {
    if (el.type === ELEMENT_TYPES.SLUGLINE) {
      scenes.push({
        head: el, index, body: 0, dialogue: 0, action: 0,
        parenthetical: 0, speakers: new Set(), lines: 0,
      })
      return
    }
    const scene = scenes[scenes.length - 1]
    if (!scene) return
    const len = visibleLength(el.text)
    scene.lines += 1
    if (el.type === ELEMENT_TYPES.DIALOGUE) scene.dialogue += len
    else if (el.type === ELEMENT_TYPES.PARENTHETICAL) { scene.parenthetical += 1; scene.action += len }
    else if (el.type === ELEMENT_TYPES.CHARACTER) scene.speakers.add(normalizeCharName(el.text))
    else scene.action += len
    scene.body += len
  })
  return scenes
}

function item(level, code, message, hint, element, sceneNo) {
  return { id: `${level}-${code}-${sceneNo ?? ''}-${Math.random().toString(36).slice(2, 6)}`, level, code, message, hint, element: element || { text: '' } }
}

export function inspectScript(elements, preset) {
  const list = Array.isArray(elements) ? elements : []
  const base = validateFormat(list, preset)
  const critical = (base.issues || []).map(i => ({ ...i, level: 'critical' }))
  const warnings = (base.warnings || []).map(i => ({ ...i, level: 'warning' }))
  const structural = []
  const suggestions = []

  if (!list.length) {
    critical.push(item('critical', 'empty', '正文为空', '导入或粘贴剧本后再检查'))
    return { critical, warnings, structural, suggestions }
  }

  const scenes = collectScenes(list)
  const hasEnglish = scenes.some(s => EN_TYPE.test(s.head.text || ''))
  const hasChinese = scenes.some(s => CN_TYPE.test(s.head.text || ''))
  const isChinese = hasChinese && !hasEnglish

  // —— 场景头检查 ——
  scenes.forEach((scene, i) => {
    const raw = String(scene.head?.text || '')
    const meta = scene.head?.meta || parseSceneMeta(raw)
    const label = `第 ${i + 1} 场`
    if (!raw.trim()) {
      critical.push(item('critical', 'empty-heading', `${label}：场景标题为空`, '补全内/外景、地点与时间', scene.head, i + 1))
      return
    }
    if (!EN_TYPE.test(raw) && !CN_TYPE.test(raw)) {
      critical.push(item('critical', 'no-int-ext', `${label}：场景头缺少「内景/外景」`, '如「INT. 咖啡馆 - 日」或「1. 内景 咖啡馆 日」', scene.head, i + 1))
    }
    if (meta && !String(meta.time || '').trim()) {
      warnings.push(item('warning', 'no-time', `${label}：场景头缺少时间`, '补充 日/夜/晨/黄昏，方便排期与分镜', scene.head, i + 1))
    }
    if (meta && !String(meta.location || '').trim()) {
      warnings.push(item('warning', 'no-location', `${label}：未能识别场景地点`, '检查场景头的写法是否规范', scene.head, i + 1))
    }
    const next = scenes[i + 1]
    if (next) {
      const a = raw.replace(SCENE_NUM, '').trim().toUpperCase()
      const b = String(next.head?.text || '').replace(SCENE_NUM, '').trim().toUpperCase()
      if (a && a === b) {
        warnings.push(item('warning', 'duplicate-scene', `${label}与第 ${i + 2} 场场景头完全相同`, '若是同一场景的延续，合并为一场并标注「连续」', scene.head, i + 1))
      }
    }
  })

  // —— 角色名一致性 ——
  const names = new Map()
  list.forEach(el => {
    if (el.type !== ELEMENT_TYPES.CHARACTER) return
    const raw = String(el.text || '').trim()
    if (!raw) return
    const key = normalizeCharName(raw)
    if (!key) return
    if (!names.has(key)) names.set(key, new Map())
    const variants = names.get(key)
    variants.set(raw, (variants.get(raw) || 0) + 1)
  })
  names.forEach(variants => {
    if (variants.size <= 1) return
    const listText = [...variants.keys()].slice(0, 4).join(' / ')
    const firstEl = list.find(el => el.type === ELEMENT_TYPES.CHARACTER && variants.has(String(el.text || '').trim()))
    warnings.push(item('warning', 'name-variant', `角色名写法不一致：${listText}`, '统一为同一写法，避免分镜与演员表统计错误', firstEl))
  })

  // —— 结构分析 ——
  let totalDialogue = 0
  let totalAction = 0
  scenes.forEach((scene, i) => {
    totalDialogue += scene.dialogue
    totalAction += scene.action
    const label = `第 ${i + 1} 场`
    if (scene.body > 0 && scene.body < 40) {
      structural.push(item('structure', 'short-scene', `${label} 过短（正文 ${scene.body} 字）`, '若只是过场可合并到相邻场景，或用动作补足信息', scene.head, i + 1))
    }
    if (scene.body > 1400) {
      structural.push(item('structure', 'long-scene', `${label} 过长（正文 ${scene.body} 字）`, '考虑按地点/时间变化拆成 2-3 场，便于拍摄', scene.head, i + 1))
    }
    if (scene.action > 500 && scene.dialogue === 0) {
      structural.push(item('structure', 'no-dialogue', `${label} 整场没有对白`, '确认是否为纯视觉段落；若需要人物关系，补 1-2 句对白', scene.head, i + 1))
    }
    if (scene.dialogue > 0 && scene.parenthetical / Math.max(1, scene.lines) > 0.3) {
      warnings.push(item('warning', 'paren-overuse', `${label} 括号提示偏多`, '括号只保留语气/动作必要的提示，其余写进描述', scene.head, i + 1))
    }
  })

  const totalText = totalDialogue + totalAction
  if (totalText > 200) {
    const ratio = totalDialogue / totalText
    if (ratio > 0.72) {
      structural.push(item('structure', 'talky', `全篇对白占比偏高（${Math.round(ratio * 100)}%）`, '补写空间、动作与视觉细节，避免「话剧化」', scenes[0]?.head))
    } else if (ratio < 0.25) {
      structural.push(item('structure', 'action-heavy', `全篇动作占比偏高（${Math.round((1 - ratio) * 100)}%）`, '检查人物关系与冲突是否有对白承载', scenes[0]?.head))
    }
  }

  // —— 建议 ——
  if (scenes.length > 0 && scenes.length < 8) {
    suggestions.push(item('suggestion', 'few-scenes', `当前仅 ${scenes.length} 场`, '长片通常 40-80 场，短片 8-20 场；确认结构是否完整', scenes[0]?.head))
  }
  const dialogueLines = list.filter(el => el.type === ELEMENT_TYPES.DIALOGUE).map(el => visibleLength(el.text) > 0 ? String(el.text).trim().replace(/\s+/g, '') : '')
  const seen = new Map()
  dialogueLines.forEach(text => {
    if (!text || text.length < 6) return
    seen.set(text, (seen.get(text) || 0) + 1)
  })
  const duplicated = [...seen.entries()].filter(([, n]) => n > 1)
  if (duplicated.length) {
    suggestions.push(item('suggestion', 'duplicate-line', `有 ${duplicated.length} 句对白完全重复`, '确认是否为有意的重复（母题/回声），否则改写', null))
  }
  const soloSpeakers = []
  names.forEach((variants, key) => {
    const count = scenes.filter(s => s.speakers.has(key)).length
    if (scenes.length >= 5 && count === 1) soloSpeakers.push([...variants.keys()][0])
  })
  if (soloSpeakers.length >= 3) {
    suggestions.push(item('suggestion', 'one-scene-chars', `${soloSpeakers.length} 个角色只出现 1 场：${soloSpeakers.slice(0, 5).join('、')}`, '确认是否有必要；可合并角色或补戏份', null))
  }

  return { critical, warnings, structural, suggestions }
}

/**
 * 可自动修复的格式问题：
 * 1. 角色名统一为出现最多的写法
 * 2. 去掉首尾空白与角色名尾部的冒号
 * 3. 删除空段落
 */
export function fixScriptFormat(elements) {
  const list = (Array.isArray(elements) ? elements : []).map(el => ({ ...el }))
  const changes = []

  const groups = new Map()
  list.forEach(el => {
    if (el.type !== ELEMENT_TYPES.CHARACTER) return
    const raw = String(el.text || '').trim()
    if (!raw) return
    const key = normalizeCharName(raw)
    if (!key) return
    if (!groups.has(key)) groups.set(key, new Map())
    const variants = groups.get(key)
    variants.set(raw, (variants.get(raw) || 0) + 1)
  })

  const canonical = new Map()
  groups.forEach((variants, key) => {
    let best = ''
    let bestCount = -1
    variants.forEach((count, raw) => {
      if (count > bestCount || (count === bestCount && raw.length < best.length)) {
        best = raw
        bestCount = count
      }
    })
    canonical.set(key, best)
  })

  list.forEach(el => {
    if (el.type === ELEMENT_TYPES.CHARACTER) {
      const raw = String(el.text || '').trim()
      const target = canonical.get(normalizeCharName(raw))
      if (target && raw !== target) {
        changes.push(`角色名统一：${raw || '空'} → ${target}`)
        el.text = target
      } else if (raw && raw !== el.text) {
        el.text = raw
      }
    } else if (el.type !== ELEMENT_TYPES.PAGEBREAK) {
      const trimmed = String(el.text || '').replace(/\s+$/, '')
      if (trimmed !== el.text) el.text = trimmed
    }
  })

  const cleaned = list.filter(el => el.type === ELEMENT_TYPES.PAGEBREAK || String(el.text || '').trim())
  if (cleaned.length !== list.length) changes.push(`删除 ${list.length - cleaned.length} 个空段落`)

  return { elements: cleaned, changes }
}
