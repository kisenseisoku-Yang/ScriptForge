// 剧本时间线数据模型
//
// 原则：剧本正文始终是唯一的内容来源。
// 时间线把正文解析成「场景对象」，场景的创作属性（故事时间、剧情线、基调、
// 戏剧功能、梗概）单独存在 localStorage，按场景指纹匹配，不重复存正文。
// 重新排序 / 删除 / 复制场景时，重建元素序列并写回剧本，正文同步更新。

import { parseScriptText, serializeScript, ELEMENT_TYPES } from './scriptParser.js'

const META_PREFIX = 'scriptforge_timeline_meta_'

/* ============================ 工具 ============================ */

export function hashKey(input) {
  const s = String(input || '')
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

function unique(list) {
  return [...new Set(list.filter(Boolean))]
}

/**
 * 场景指纹：标题（去掉场号）+ 正文，用于把场景属性和正文里的场景对应起来。
 * 去掉场号是为了让重新编号、重排后指纹不变。
 */
export function sceneKey(elements) {
  const head = elements?.[0]
  const heading = String(head?.text || '')
    .replace(/^\s*(?:sc|scene|场)?\s*\d+\s*[.、:：\-—]?\s*/i, '')
    .trim()
  const body = elements.slice(1).map(el => String(el.text || '')).join('\n')
  return hashKey(heading + '|' + body.slice(0, 240))
}

/* ============================ 解析 ============================ */

/**
 * 把剧本正文切成场景列表。
 * 场景头之前的元素（标题页 / 注释）作为片头保留。
 */
export function parseScenes(text, formatId = 'hollywood') {
  const elements = parseScriptText(text, formatId)
  const front = []
  const groups = []

  elements.forEach(el => {
    if (el.type === ELEMENT_TYPES.SLUGLINE) groups.push([el])
    else if (groups.length) groups[groups.length - 1].push(el)
    else front.push(el)
  })

  const scenes = groups.map((group, index) => {
    const head = group[0]
    const meta = head.meta || {}
    const characters = unique(
      group
        .filter(el => el.type === ELEMENT_TYPES.CHARACTER)
        .map(el => String(el.text || '').replace(/^【|】$/g, '').replace(/\(.*?\)/g, '').trim())
    )
    const body = group
      .filter(el => el.type !== ELEMENT_TYPES.SLUGLINE)
      .map(el => String(el.text || ''))
      .join('\n')
    const chars = body.replace(/\s/g, '').length
    const key = sceneKey(group)
    return {
      id: `sc_${index}_${key}`,
      key,
      index,
      heading: head.text,
      intExt: meta.intExt || '',
      location: meta.location || '',
      timeOfDay: meta.timeOfDay || '',
      elements: group,
      characters,
      body,
      // 粗略估算：中文剧本约 1000 字 ≈ 1 分钟
      duration: Math.max(0.5, Math.round((chars / 1000) * 2) / 2),
    }
  })

  return { front, scenes }
}

/** 场景序列 + 片头 → 剧本正文（按模板重排并重新编场号） */
export function buildScriptText(front, scenes, formatId) {
  const flat = [...front, ...scenes.flatMap(scene => scene.elements)]
  return serializeScript(flat, formatId)
}

/* ============================ 属性存储 ============================ */

export function loadTimelineMeta(scriptId) {
  if (!scriptId) return { scenes: {}, archived: [], tracks: [] }
  try {
    const raw = localStorage.getItem(META_PREFIX + scriptId)
    const parsed = raw ? JSON.parse(raw) : null
    return {
      scenes: parsed?.scenes || {},
      archived: Array.isArray(parsed?.archived) ? parsed.archived : [],
      tracks: Array.isArray(parsed?.tracks) ? parsed.tracks : [],
    }
  } catch {
    return { scenes: {}, archived: [], tracks: [] }
  }
}

export function saveTimelineMeta(scriptId, meta) {
  if (!scriptId) return
  try {
    localStorage.setItem(META_PREFIX + scriptId, JSON.stringify(meta))
  } catch {}
}

/* ============================ 排序 ============================ */

/**
 * 故事时间 → 可比较数值。支持「2019年冬」「2020-03」「第3天」等写法，
 * 识别不出来时用 null，排序时保持原叙事顺序。
 */
export function storySortValue(value) {
  if (!value) return null
  const s = String(value)
  const ymd = s.match(/(\d{4})\D{0,2}(\d{1,2})?\D{0,2}(\d{1,2})?/)
  if (ymd) {
    const y = Number(ymd[1])
    const m = Number(ymd[2] || 1)
    const d = Number(ymd[3] || 1)
    return y * 10000 + m * 100 + d
  }
  const day = s.match(/第?\s*(\d+)\s*[天日]/)
  if (day) return Number(day[1])
  return null
}
