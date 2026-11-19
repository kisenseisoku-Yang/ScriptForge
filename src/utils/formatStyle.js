// 格式 → 渲染样式的唯一来源
//
// 编辑区和预览区都从这里取样式，模板切换时两边必须同时变化：
//   - 预览：ScriptElement 把 getElementStyle 的结果直接内联到元素上
//   - 编辑区：decorateEditorHtml 把同样的样式写进每个段落块
//
// 行业规范按【纸张边缘】计量，CSS 的 margin 相对【正文框】，
// 所以这里统一换算：正文内缩进 = 规范值 − 对应页边距。

import { isSceneLine } from './scriptParser.js'

const FALLBACK = {
  english: {
    characterIndentIn: 3.7,
    dialogueLeftIn: 3.1,
    dialogueRightIn: 2.9,
    parentheticalLeftIn: 3.1,
    parentheticalRightIn: 2.9,
  },
  chinese: {
    characterIndentIn: 0,
    dialogueLeftIn: 0,
    dialogueRightIn: 0,
    parentheticalLeftIn: 0,
    parentheticalRightIn: 0,
  },
}

function num(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function fontStack(family) {
  return String(family || 'Courier Prime')
    .split(',')
    .map(name => name.trim())
    .filter(Boolean)
    .map(name => (/\s/.test(name) && !/^['"]/.test(name) ? `'${name}'` : name))
    .join(', ')
}

function inset(value, margin, unit = 'in') {
  return `${Math.max(0, num(value) - num(margin)).toFixed(2)}${unit}`
}

const ELEMENT_CLASS = {
  slugline: 'slugline',
  action: 'action',
  character: 'character',
  parenthetical: 'parenthetical',
  dialogue: 'dialogue',
  transition: 'transition',
  shot: 'shot',
  teaser: 'teaser',
  act: 'act',
  endact: 'endact',
  subheading: 'subheading',
  note: 'note',
  title: 'title',
}

/**
 * 某个元素在此模板下的内联样式
 * @param {object} format formatPresets 中的预设
 * @param {string} type 元素类型
 */
export function getElementStyle(format, type) {
  if (!format) return {}
  const family = format.family === 'chinese' ? 'chinese' : 'english'
  const isCn = family === 'chinese'
  const base = FALLBACK[family]
  const margins = format.margins || {}
  const unit = margins.unit || 'in'
  const slug = format.slugline || {}
  const character = format.character || {}
  const dialogue = format.dialogue || {}
  const paren = format.parenthetical || {}
  const transition = format.transition || {}
  const action = format.action || {}

  const upper = (cfg, fallback = false) => (cfg?.uppercase ?? fallback ? 'uppercase' : 'none')
  const bold = (cfg, fallback = false) => ((cfg?.bold ?? fallback) ? 700 : 400)

  switch (type) {
    case 'slugline':
      return {
        textTransform: upper(slug, !isCn),
        fontWeight: bold(slug, true),
        marginTop: '12pt',
        marginBottom: '10pt',
      }
    case 'action':
      return {
        textIndent: action.indentEm ? `${action.indentEm}em` : undefined,
        marginBottom: '10pt',
      }
    case 'character': {
      const centered = format.id === 'stage' || isCn || format.radioFormat === true
      return {
        textTransform: upper(character, family === 'english'),
        fontWeight: bold(character, false),
        marginLeft: centered ? '0' : inset(character.indentIn ?? base.characterIndentIn, margins.left, unit),
        textAlign: centered ? 'center' : 'left',
        marginTop: '10pt',
      }
    }
    case 'parenthetical':
      return {
        marginLeft: inset(paren.leftIn ?? base.parentheticalLeftIn, margins.left, unit),
        marginRight: inset(paren.rightIn ?? base.parentheticalRightIn, margins.right, unit),
        textAlign: format.id === 'stage' || isCn ? 'center' : 'left',
        fontStyle: isCn ? 'normal' : 'italic',
        lineHeight: dialogue.doubleSpaced ? 2 : undefined,
      }
    case 'dialogue':
      return {
        marginLeft: inset(dialogue.leftIn ?? base.dialogueLeftIn, margins.left, unit),
        marginRight: inset(dialogue.rightIn ?? base.dialogueRightIn, margins.right, unit),
        textIndent: dialogue.indentEm ? `${dialogue.indentEm}em` : undefined,
        marginBottom: '10pt',
        // 多机位情景喜剧：对白双倍行距（有资料支撑的版式差异）
        lineHeight: dialogue.doubleSpaced ? 2 : undefined,
      }
    case 'transition':
      return {
        textAlign: transition.flushRight === false ? 'left' : 'right',
        textTransform: upper(transition, !isCn),
        fontWeight: bold(transition, true),
        marginBottom: '10pt',
      }
    case 'title':
      return { textAlign: 'center', fontWeight: 700, marginBottom: '18pt' }
    case 'shot':
      return { textTransform: 'uppercase', fontWeight: 700, marginBottom: '10pt' }
    case 'teaser':
    case 'act':
    case 'endact':
      return { textAlign: 'center', textTransform: 'uppercase', fontWeight: 700, margin: '14pt 0' }
    default:
      return {}
  }
}

/** 编辑区容器的排版度量：字体、字号、行距、页面宽度与页边距 */
export function getPageStyle(format) {
  if (!format) return {}
  const page = format.page || {}
  const margins = format.margins || {}
  const unit = page.unit || 'in'
  return {
    fontFamily: fontStack(format.font?.family),
    fontSize: `${num(format.font?.sizePt, 12)}pt`,
    lineHeight: format.lineHeightPt
      ? `${format.lineHeightPt}pt`
      : String(format.lineHeight || 1.15),
    maxWidth: page.width ? `${page.width}${unit}` : undefined,
    paddingTop: margins.top != null ? `${margins.top}${margins.unit || unit}` : undefined,
    paddingBottom: margins.bottom != null ? `${margins.bottom}${margins.unit || unit}` : undefined,
    paddingLeft: margins.left != null ? `${margins.left}${margins.unit || unit}` : undefined,
    paddingRight: margins.right != null ? `${margins.right}${margins.unit || unit}` : undefined,
  }
}

function styleToCss(style) {
  return Object.entries(style)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}:${value}`)
    .join(';')
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * 把纯文本按结构装饰成段落块，供 contentEditable 使用。
 * 每个块带元素类型 class + 模板内联样式；空行保留，避免输入时丢行。
 */
export function decorateEditorHtml(text, format, elements) {
  const lines = String(text || '').split('\n')
  const source = Array.isArray(elements) && elements.length
    ? elements.filter(el => el && el.text != null)
    : []

  const html = []
  let cursor = 0
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      html.push('<div class="script-el blank"><br></div>')
      continue
    }
    // 按顺序匹配已解析的元素，保证「角色名 / 对白 / 动作」不串位。
    // 场景头的解析结果会重写成模板格式（如 "1. 内景 走廊 夜"），
    // 与原文不同，所以场景行按结构判断而不是逐字相等。
    let type = 'action'
    while (cursor < source.length) {
      const el = source[cursor]
      cursor++
      if (String(el.text || '').trim() === trimmed) {
        type = el.type
        break
      }
      // 「角色：台词」写在同一行时，解析器会把台词拆成单独元素，
      // 元素文本只是原始行的一段后缀，这里按后缀匹配，避免整行被当成动作。
      if (el.text && el.type !== 'slugline' && trimmed.endsWith(String(el.text).trim())) {
        type = el.type
        break
      }
      // 中文模板会把角色名序列化成「【安娜】」，解析结果里是不带括号的名字，
      // 这里按去括号后的名字匹配，避免整段对白连锁错位成动作。
      if (el.type === 'character' && trimmed.replace(/^【|】$/g, '').trim() === String(el.text || '').trim()) {
        type = 'character'
        break
      }
      if (el.type === 'slugline' && isSceneLine(trimmed)) {
        type = 'slugline'
        break
      }
    }
    // 兜底：元素已耗尽或没对上时，仍按结构识别场景行
    if (type === 'action' && !source.length && isSceneLine(trimmed)) type = 'slugline'
    const cls = ELEMENT_CLASS[type] || 'action'
    const css = styleToCss(getElementStyle(format, type))
    html.push(`<div class="script-el ${cls}"${css ? ` style="${css}"` : ''}>${escapeHtml(line)}</div>`)
  }
  return html.join('')
}
