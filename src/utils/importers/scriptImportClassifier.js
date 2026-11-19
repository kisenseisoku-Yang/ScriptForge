// 段落分类器：把 DOCX 段落对象（样式名 + 几何 + 上下文）判定为剧本元素类型。
//
// 输入来自 docxImporter.extractDocxParagraphs：
//   { text, styleId, styleName, bold, italic, align, indentIn, pageBreak }
// 输出与 parseScriptText 一致的元素数组：{ type, text }，可直接交给 serializeScript。
//
// 两条识别路线：
//   1) 内联提示模式：中文剧本常见「顾 源：台词」「导演：（递还）行了」的写法，
//      每个段落自带说话人。此类文档用提示行直接切分角色 + 括注 + 对白，最稳。
//   2) 版式模式：好莱坞式一行角色名一行台词、依赖 Word 样式或缩进/居中。
// 两种模式都先判断场景头、转场、标题，避免把场景头当成角色名。

import {
  ELEMENT_TYPES,
  normalizeCharacterName,
  isSceneLine,
  isTransitionLine,
  isParentheticalLine,
} from '../scriptParser.js'

// 样式名 → 元素类型。按顺序匹配，先具体后宽泛。
const STYLE_RULES = [
  [/heading\s*[12]|heading[12]|title|标题|副标题|片名|剧名/, 'title'],
  [/scenario|sceneheading|slugline|场景标题|场景头|场次标题/, 'slugline'],
  [/scene(\s|\b)|场景|场次/, 'slugline'],
  [/character|角色|人物|角色名/, 'character'],
  [/parenthetical|wryly|括号|旁注|提示/, 'parenthetical'],
  [/dialogue|dialog|对白|台词|对话/, 'dialogue'],
  [/transition|转场|过渡/, 'transition'],
  [/shot|镜头/, 'shot'],
  [/action|动作|描述|说明/, 'action'],
]

// Word 默认样式：不能当成剧本类型，否则所有正文都会被强制判成动作。
const NEUTRAL_STYLE = /^(?:normal|bodytext|正文|默认|default|general|普通|无间隔|no\s*spacing)$/i

function styleKind(styleName) {
  const value = String(styleName || '').trim().toLowerCase().replace(/[\s_\-]+/g, '')
  if (!value) return ''
  if (NEUTRAL_STYLE.test(value)) return ''
  for (const [re, kind] of STYLE_RULES) {
    if (re.test(value)) return kind
  }
  return ''
}

const TERMINAL_PUNCT = /[。！？；.!?;：:]$/
const CJK = '\\u3400-\\u9fff'

// 不是人物名的「冒号前文字」
const CUE_BLACKLIST = /^(?:编剧|人物|角色|场景|场次|镜头|画面|字幕|时间|地点|背景|注|备注|音效|音乐|旁白|故事|主题|类型|片名|剧名|一句话故事|人物介绍)$/
const CUE_LEAD_BLACKLIST = /^(?:但|而|于是|所以|因为|如果|虽然|然后|接着|随后|这时|此时|据|按照|根据|随着|忽然|突然|终于|最后|首先|其次|另外|此外|总之|同时|远处|台上|台下|画面|镜头)/
const CUE_TAIL_BLACKLIST = /[的着了在是和与上中里下时后前边处口间]$/

/**
 * 中文内联提示：`顾 源：台词` / `导演：（递还）行了`
 * 返回 { name, content }；不是提示行返回 null。
 */
export function splitInlineCue(value) {
  const text = String(value || '').trim()
  const match = text.match(/^([^：:]{1,12})[：:]\s*(.+)$/)
  if (!match) return null
  const rawName = match[1].trim()
  const content = match[2].trim()
  if (!rawName || !content) return null
  if (/[。！？，,；;、…“”"'《》（）]/.test(rawName)) return null
  const name = rawName.replace(/\s+/g, '')
  if (!name || name.length > 6) return null
  if (CUE_BLACKLIST.test(name) || CUE_LEAD_BLACKLIST.test(name) || CUE_TAIL_BLACKLIST.test(name)) return null
  if (!new RegExp(`^[${CJK}A-Za-z0-9·•.'’()（）-]+$`).test(name)) return null
  return { name, content }
}

/** 提示行 → 角色 + 若干括注 + 对白 */
function pushCue(elements, cue) {
  elements.push({ type: ELEMENT_TYPES.CHARACTER, text: cue.name })
  let rest = cue.content
  for (let i = 0; i < 3; i++) {
    const match = rest.match(/^[（(]([^）)]{1,40})[）)]\s*/)
    if (!match) break
    elements.push({ type: ELEMENT_TYPES.PARENTHETICAL, text: `（${match[1]}）` })
    rest = rest.slice(match[0].length)
  }
  if (rest.trim()) elements.push({ type: ELEMENT_TYPES.DIALOGUE, text: rest.trim() })
}

function isCharacterCandidate(p, ignoreBold) {
  const text = String(p.text || '').trim()
  const name = normalizeCharacterName(text)
  if (!name || name.length > 24) return false
  if (TERMINAL_PUNCT.test(text)) return false
  if (isSceneLine(text) || isTransitionLine(text) || isParentheticalLine(text)) return false
  // 至少有一个强线索：居中 / 加粗 / 明显缩进
  const centered = p.align === 'center'
  const bold = !ignoreBold && (p.bold === true || Number(p.bold) >= 0.8)
  const indented = Number(p.indentIn) >= 0.9
  return centered || bold || indented
}

function normalizeText(value) {
  return String(value || '').replace(/\t+/g, ' ').trim()
}

/** 内联提示模式：每段自带说话人，按提示行切分 */
function classifyInline(source) {
  const elements = []
  for (const p of source) {
    const text = normalizeText(p.text)
    if (p.pageBreak) elements.push({ type: ELEMENT_TYPES.PAGE_BREAK, text: '' })
    if (!text) continue

    const kind = styleKind(p.styleName)

    if (kind === 'title') {
      elements.push({ type: ELEMENT_TYPES.TITLE, text })
      continue
    }
    if (kind === 'slugline' || isSceneLine(text)) {
      elements.push({ type: ELEMENT_TYPES.SLUGLINE, text })
      continue
    }
    if (kind === 'transition' || isTransitionLine(text)) {
      elements.push({ type: ELEMENT_TYPES.TRANSITION, text })
      continue
    }

    const cue = splitInlineCue(text)
    if (cue) {
      pushCue(elements, cue)
      continue
    }

    if (kind === 'parenthetical' || isParentheticalLine(text)) {
      elements.push({ type: ELEMENT_TYPES.PARENTHETICAL, text })
      continue
    }

    elements.push({ type: ELEMENT_TYPES.ACTION, text })
  }
  return elements
}

/** 版式模式：依赖 Word 样式 / 缩进 / 居中 / 上下文 */
function classifyStyled(source) {
  const elements = []
  // 整篇都加粗的文档（比如把正文设成粗体的中文稿），加粗不能作为角色名线索
  const boldRatio = source.filter(p => p.bold === true || Number(p.bold) >= 0.8).length / source.length
  const ignoreBold = boldRatio > 0.5

  let inDialogue = false
  let dialogueIndent = 0

  for (const p of source) {
    const text = normalizeText(p.text)
    if (p.pageBreak) elements.push({ type: ELEMENT_TYPES.PAGE_BREAK, text: '' })
    if (!text) continue

    const kind = styleKind(p.styleName)
    const push = (type) => elements.push({ type, text })

    if (kind === 'title') {
      push(ELEMENT_TYPES.TITLE)
      inDialogue = false
      continue
    }

    if (kind === 'slugline' || (!kind && isSceneLine(text))) {
      push(ELEMENT_TYPES.SLUGLINE)
      inDialogue = false
      continue
    }

    if (kind === 'transition' || (!kind && isTransitionLine(text))) {
      push(ELEMENT_TYPES.TRANSITION)
      inDialogue = false
      continue
    }

    if (kind === 'parenthetical' || (!kind && isParentheticalLine(text))) {
      push(ELEMENT_TYPES.PARENTHETICAL)
      inDialogue = true
      continue
    }

    if (kind === 'character') {
      push(ELEMENT_TYPES.CHARACTER)
      inDialogue = true
      dialogueIndent = 0
      continue
    }

    // 行内提示：ANNA: You're late.
    if (!kind || kind === 'dialogue') {
      const cue = splitInlineCue(text)
      if (cue) {
        pushCue(elements, cue)
        inDialogue = true
        dialogueIndent = 0
        continue
      }
    }

    if (!kind && isCharacterCandidate(p, ignoreBold)) {
      push(ELEMENT_TYPES.CHARACTER)
      inDialogue = true
      dialogueIndent = 0
      continue
    }

    if (kind === 'dialogue') {
      push(ELEMENT_TYPES.DIALOGUE)
      inDialogue = true
      if (!dialogueIndent && Number(p.indentIn) > 0.3) dialogueIndent = Number(p.indentIn)
      continue
    }

    if (!kind && inDialogue) {
      const indent = Number(p.indentIn) || 0
      const looksAction = text.length > 80 || (dialogueIndent >= 0.4 && indent < dialogueIndent - 0.15)
      if (!looksAction) {
        push(ELEMENT_TYPES.DIALOGUE)
        if (!dialogueIndent && indent > 0.3) dialogueIndent = indent
        continue
      }
      inDialogue = false
    }

    if (kind === 'shot') {
      push(ELEMENT_TYPES.SHOT)
      inDialogue = false
      continue
    }

    push(ELEMENT_TYPES.ACTION)
    inDialogue = false
    dialogueIndent = 0
  }

  return elements
}

/**
 * @param {Array} paragraphs extractDocxParagraphs 的输出
 * @returns {Array<{type:string,text:string}>|null}
 */
export function classifyParagraphs(paragraphs) {
  const source = Array.isArray(paragraphs) ? paragraphs : []
  if (!source.length) return null

  const cues = source.filter(p => splitInlineCue(p.text)).length
  // 内联提示够多，说明作者是「名字：台词」写法，直接按提示行切分
  if (cues >= 5 && cues / source.length >= 0.06) {
    const elements = classifyInline(source)
    return elements.length ? elements : null
  }

  const styledCount = source.filter(p => styleKind(p.styleName)).length
  const geometryCount = source.filter(
    p => Number(p.indentIn) >= 0.9 || p.align === 'center'
  ).length
  // 没有结构线索的 DOCX（纯打字稿）交给纯文本识别器，避免强行误判
  if (styledCount < 2 && geometryCount < 2) return null

  const elements = classifyStyled(source)
  return elements.length ? elements : null
}
