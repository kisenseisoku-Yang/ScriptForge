// 剧本数据模型、结构识别器与模板排版
//
// 核心能力：用户上传/粘贴的文本可以完全不带格式。
// 识别器负责从纯文本里推断出：
//   场景头（内景/外景、地点、时间）、角色、动作、对白、括号提示、转场、分页
// 然后把同一份结构数据按 好莱坞 / Netflix / BBC / 中国广电 / Fountain / 自由 六套模板重新排版。
//
// 重要约定：识别器不依赖当前模板。切换模板时始终使用同一份结构数据，
// 避免「好莱坞 → 中国广电 → 好莱坞」往返时结构退化。

import { nanoid } from 'nanoid'
import { getPresetById } from '../config/formatPresets.js'

// 元素类型定义
export const ELEMENT_TYPES = {
  SLUGLINE: 'slugline',     // 场景标题 INT. LOCATION - DAY
  ACTION: 'action',         // 动作描写
  CHARACTER: 'character',   // 角色名
  PARENTHETICAL: 'parenthetical', // 括号注释 (whispering)
  DIALOGUE: 'dialogue',     // 对话
  DUAL_DIALOGUE: 'dualdialogue', // 双人对话（左右并排）
  TRANSITION: 'transition', // 转场 CUT TO:
  NOTE: 'note',             // 注释
  PAGE_BREAK: 'pagebreak',  // 分页 ===
  TEASER: 'teaser',         // TEASER / COLD OPEN
  ACT: 'act',               // ACT ONE / 第一幕
  END_ACT: 'endact',        // END OF ACT / 第一幕完
  SHOT: 'shot',             // 镜头描述 CLOSE ON / 特写
  SUBHEADING: 'subheading', // 小标题 MONTAGE / ## 标记
  TITLE: 'title',           // 标题页元素
}

/* ============================================================
 *  基础工具
 * ============================================================ */

const ENGLISH_SCENE_RE = /^(?:INT\.?\/EXT\.?|INT\.?|EXT\.?|EST\.?|I\/E\.?)(?:\s|\.|$)/i
const ENGLISH_TRANSITION_RE = /^(?:FADE (?:IN|OUT)|CUT TO|DISSOLVE(?: TO)?|SMASH CUT|MATCH CUT|CUT BACK TO|FADE TO BLACK|END OF .+|THE END)[.:]?$/i
const SCENE_NUMBER_ONLY_RE = /^(?:(?:SCENE|ACT)\s*\d+|场景\s*[0-9一二三四五六七八九十百]+|场次\s*\d+|第\s*[0-9一二三四五六七八九十百]+\s*场)\s*[·.、:：\-—]?\s*$/i

// 幕 / 场结构标记
const TEASER_RE = /^(?:TEASER|COLD\s+OPEN(?:ING)?|序幕|开场|片头|楔子)$/i
const END_ACT_RE = /^(?:END\s+OF\s+(?:ACT(?:\s+[A-Z0-9]+)?|TEASER|COLD\s+OPEN)|第\s*[0-9一二三四五六七八九十]+\s*幕\s*(?:完|结束))[.:]?$/i
const ACT_RE = /^(?:ACT\s+(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|[IVXLC]+|\d+)|第\s*[0-9一二三四五六七八九十]+\s*幕)[.:]?$/i

// 镜头 / 小标题
const EN_SHOT_RE = /^(?:CLOSE(?:-?\s?UP)?(?:\s+ON)?|WIDE(?:\s+ON)?|ANGLE(?:\s+ON)?|INSERT|POV|AERIAL|ESTABLISHING|TRACKING|PAN(?:NING)?\s+TO|TILT(?:ING)?\s+TO|SHOT\s*[:：])/i
const CN_SHOT_RE = /^(?:镜头|特写|近景|中景|远景|全景|俯拍|仰拍|航拍|跟拍|摇镜|推镜|拉镜|定格)[：:]/
const SUBHEADING_RE = /^(?:#{1,6}\s+\S|〔[^〕]+〕$|(?:MONTAGE|SERIES\s+OF\s+SHOTS|INSERT\s+SEQUENCE|FLASHBACK|INTERCUT|BACK\s+TO\s+PRESENT|TITLE\s+CARD|SUPER)$|(?:蒙太奇|闪回|插叙|倒叙|字卡)$)/i

const CJK = '\\u3400-\\u9fff'

function cleanText(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\u200b/g, '')
    .replace(/\u3000/g, '　')
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function smartUpper(s) {
  return String(s || '').replace(/[A-Za-z]/g, c => c.toUpperCase())
}

/* ============================================================
 *  地点 / 时间词典（用于从叙述文字里推断场景）
 * ============================================================ */

const LOCATION_LEXICON = [
  // [词, 类型, 归一名]
  ['出租屋', 'INT', '出租屋'],
  ['出租房', 'INT', '出租屋'],
  ['公寓', 'INT', '公寓'],
  ['客厅', 'INT', '客厅'],
  ['厨房', 'INT', '厨房'],
  ['卧室', 'INT', '卧室'],
  ['浴室', 'INT', '浴室'],
  ['卫生间', 'INT', '卫生间'],
  ['洗手间', 'INT', '洗手间'],
  ['阳台', 'INT', '阳台'],
  ['玄关', 'INT', '玄关'],
  ['走廊', 'INT', '走廊'],
  ['电梯', 'INT', '电梯'],
  ['楼梯间', 'INT', '楼梯间'],
  ['办公室', 'INT', '办公室'],
  ['会议室', 'INT', '会议室'],
  ['教室', 'INT', '教室'],
  ['病房', 'INT', '病房'],
  ['医院', 'INT', '医院'],
  ['咖啡馆', 'INT', '咖啡馆'],
  ['咖啡厅', 'INT', '咖啡馆'],
  ['酒吧', 'INT', '酒吧'],
  ['餐厅', 'INT', '餐厅'],
  ['饭馆', 'INT', '饭馆'],
  ['便利店', 'INT', '便利店'],
  ['超市', 'INT', '超市'],
  ['商场', 'INT', '商场'],
  ['书店', 'INT', '书店'],
  ['图书馆', 'INT', '图书馆'],
  ['酒店', 'INT', '酒店'],
  ['旅馆', 'INT', '旅馆'],
  ['车里', 'INT', '车内'],
  ['车内', 'INT', '车内'],
  ['地铁', 'INT', '地铁'],
  ['公交车', 'INT', '公交车'],
  ['火车', 'INT', '火车'],
  ['飞机', 'INT', '飞机'],
  ['门口', 'INT', '门口'],
  ['家里', 'INT', '家'],
  ['家中', 'INT', '家'],
  ['家', 'INT', '家'],
  ['街上', 'EXT', '街道'],
  ['街头', 'EXT', '街道'],
  ['路上', 'EXT', '街道'],
  ['马路', 'EXT', '街道'],
  ['路边', 'EXT', '街道'],
  ['街道', 'EXT', '街道'],
  ['巷口', 'EXT', '巷口'],
  ['巷子', 'EXT', '巷子'],
  ['胡同', 'EXT', '胡同'],
  ['小区', 'EXT', '小区'],
  ['公园', 'EXT', '公园'],
  ['广场', 'EXT', '广场'],
  ['操场', 'EXT', '操场'],
  ['校园', 'EXT', '校园'],
  ['楼下', 'EXT', '楼下'],
  ['天台', 'EXT', '天台'],
  ['屋顶', 'EXT', '屋顶'],
  ['海边', 'EXT', '海边'],
  ['沙滩', 'EXT', '沙滩'],
  ['河边', 'EXT', '河边'],
  ['桥上', 'EXT', '桥上'],
  ['森林', 'EXT', '森林'],
  ['田野', 'EXT', '田野'],
  ['雪地', 'EXT', '雪地'],
  ['山路', 'EXT', '山路'],
  ['车站', 'EXT', '车站'],
  ['站台', 'EXT', '站台'],
  ['停车场', 'EXT', '停车场'],
]

// 长词优先，避免「家」抢在「出租屋」前面
const LOCATION_SORTED = [...LOCATION_LEXICON].sort((a, b) => b[0].length - a[0].length)
const LOCATION_NAMES = new Set(LOCATION_LEXICON.map(item => item[2]))

function findLocation(text) {
  const source = String(text || '')
  let best = null
  for (const [word, type, name] of LOCATION_SORTED) {
    const index = source.indexOf(word)
    if (index === -1) continue
    if (!best || word.length > best.word.length) best = { word, type, name, index }
  }
  if (!best) return null
  return { word: best.word, type: best.type, name: best.name }
}

const TIME_RULES = [
  [/(?:凌晨|深夜|午夜|夜晚|夜里|夜色|入夜)/, '夜'],
  [/(?:傍晚|黄昏|日落)/, '昏'],
  [/(?:清晨|黎明|破晓|早晨|早上|天亮)/, '晨'],
  [/(?:中午|正午|午后|下午|白天)/, '日'],
  [/(?:下班|收工|放工|加班|应酬)/, '夜'],
  [/夜/, '夜'],
  [/(?:雪|灯|月光|星光|入睡|睡梦|梦)/, '夜'],
]

function findTime(text) {
  const source = String(text || '')
  for (const [re, value] of TIME_RULES) {
    if (re.test(source)) return value
  }
  return ''
}

const CN_TIME_MAP = {
  NIGHT: '夜', DAY: '日', MORNING: '晨', EVENING: '晚', DUSK: '昏', DAWN: '晨',
  深夜: '夜', 凌晨: '夜', 午夜: '夜', 夜晚: '夜', 晚上: '夜', 夜色: '夜', 夜里: '夜',
  傍晚: '昏', 黄昏: '昏', 清晨: '晨', 早晨: '晨', 早上: '晨', 黎明: '晨',
  中午: '日', 正午: '日', 下午: '日', 白天: '日',
  夜: '夜', 日: '日', 晨: '晨', 昏: '昏', 晚: '晚',
}

function toCnTime(value) {
  const key = String(value || '').trim()
  return CN_TIME_MAP[key] || CN_TIME_MAP[key.toUpperCase()] || ''
}

function normalizeSceneType(value) {
  const raw = String(value || '').toUpperCase().replace(/\s/g, '')
  if (!raw) return 'INT'
  if (raw.includes('内外') || raw.includes('INT./EXT') || raw.includes('I/E')) return 'INT./EXT.'
  if (raw.includes('外') || raw.startsWith('EXT') || raw.startsWith('EST')) return 'EXT'
  return 'INT'
}

/* ============================================================
 *  场景头解析与渲染
 * ============================================================ */

export function parseSceneMeta(text) {
  let raw = String(text || '').trim().replace(/^\.\s*/, '').replace(/^>\s*/, '')
  if (!raw) return null

  let type = ''

  // 场次编号：1. / 1) / 1、 （Netflix 制作稿）
  raw = raw.replace(/^\d+\s*[、.．)]\s*/, ' ').replace(/^\d+\s+/, ' ').trim()

  // 中文「地点-时间-内/外」：殡仪馆走廊-夜-内、地铁站-日-内转外
  if (isHyphenSceneLine(raw)) {
    let segType = ''
    let segTime = ''
    const words = []
    raw.split(/[\s·\-—－–]+/).filter(Boolean).forEach(seg => {
      if (!segType && CN_SCENE_TYPE_SEG.test(seg)) segType = seg
      else if (!segTime && CN_SCENE_TIME_SEG.test(seg)) segTime = seg
      else words.push(seg)
    })
    if (segType && segTime && words.length) {
      type = /内外|内转外|外转内/.test(segType)
        ? 'INT./EXT.'
        : /^外/.test(segType) ? 'EXT' : 'INT'
      return { type, location: words.join(' '), time: segTime }
    }
  }

  // 英文 INT. / EXT. / INT./EXT.
  const en = raw.match(/^(INT\.\/EXT\.|INT\.|EXT\.|EST\.|I\/E\.?)\s*(.*)$/i)
  if (en) {
    type = normalizeSceneType(en[1])
    raw = en[2]
  }

  // 中文 内景 / 外景 / 内外景
  if (/内外景|内\/外/.test(raw)) type = 'INT./EXT.'
  else if (/外景/.test(raw)) type = type || 'EXT'
  else if (/内景/.test(raw)) type = type || 'INT'
  raw = raw.replace(/内外景|内\/外|外景|内景/g, ' ')

  // 场景编号、场次前缀
  raw = raw
    .replace(/【\s*[^】]{0,20}】/g, ' ')
    .replace(new RegExp(`^(?:第\\s*[0-9一二三四五六七八九十百]+\\s*场|场景\\s*[0-9一二三四五六七八九十百]+|场次\\s*\\d+|SCENE\\s*\\d+)\\s*[·.、:：\\-—]?\\s*`, 'i'), ' ')
    .replace(/^\d+\s*[、.．]\s*/, ' ')
    .replace(/^\d+\s+/, ' ')

  // 时间：只从结尾提取，避免误伤地点名里的「日」
  const timeMatch = raw.match(/(?:^|[\s·•\-—–])(凌晨|深夜|午夜|夜晚|晚上|夜色|夜里|傍晚|黄昏|清晨|早晨|早上|黎明|中午|正午|下午|白天|NIGHT|DAY|MORNING|EVENING|DUSK|DAWN|夜|日|晨|昏|晚)(?:\s*\(CONT'D\))?\s*$/i)
  let time = ''
  if (timeMatch) {
    time = timeMatch[1]
    raw = raw.slice(0, timeMatch.index)
  }

  raw = raw
    .replace(/\(CONT'D\)/ig, ' ')
    .replace(/[·•]/g, ' ')
    .replace(/^[\s\-—–:：]+|[\s\-—–:：]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  const loc = findLocation(raw)
  const location = loc ? loc.name : raw
  if (!location) return null
  if (!type) type = loc ? loc.type : 'INT'
  return { type, location, time }
}

function renderSlugline(meta, formatId, sceneNumber = 1) {
  const preset = getPresetById(formatId)
  const type = normalizeSceneType(meta?.type)
  const location = String(meta?.location || '').trim()
  const time = String(meta?.time || '').trim()

  if (formatId === 'cn-gov') {
    const cnType = type === 'EXT' ? '外景' : type === 'INT./EXT.' ? '内外景' : '内景'
    const cnTime = toCnTime(time) || '日'
    return `【${String(sceneNumber).padStart(2, '0')}】${location || '未命名场景'} ${cnType} ${cnTime}`
  }

  if (formatId === 'free') {
    const cnType = type === 'EXT' ? '外景' : type === 'INT./EXT.' ? '内外景' : '内景'
    return `${cnType} ${location || '未命名场景'}${time ? ` · ${time}` : ''}`
  }

  // 中文电影 / 电视剧 / 网络剧：场号 + 内景/外景 + 地点 + 日夜
  if (preset.family === 'chinese') {
    const cnType = type === 'EXT' ? '外景' : type === 'INT./EXT.' ? '内外景' : '内景'
    const cnTime = toCnTime(time) || '日'
    return `${sceneNumber}. ${cnType} ${location || '未命名场景'} ${cnTime}`
  }

  const prefix = type === 'EXT' ? 'EXT.' : type === 'INT./EXT.' ? 'INT./EXT.' : 'INT.'
  // 中文时间词转英文，保证中文剧本导出好莱坞格式时场景头可读
  const EN_TIME = { 日: 'DAY', 夜: 'NIGHT', 晨: 'MORNING', 昏: 'DUSK', 晚: 'EVENING' }
  const enTime = EN_TIME[time] || time
  const line = `${prefix} ${location || 'UNNAMED LOCATION'}${enTime ? ` - ${enTime}` : ''}`
  // 制作 / 拍摄稿带场号；纯投稿稿不带
  return preset.sceneNumbers ? `${sceneNumber}. ${line}` : line
}

/* ============================================================
 *  文本结构识别
 * ============================================================ */

export function normalizeCharacterName(value) {
  let name = String(value || '').trim().replace(/^@/, '')
  if (name.startsWith('*') && name.endsWith('*')) name = name.slice(1, -1).trim()
  name = name
    .replace(/^【\s*(.+?)\s*】$/, '$1')
    .replace(/^\[\s*(.+?)\s*\]$/, '$1')
    .replace(/\s*\((?:CONT'?D|CONTD|CONTINUED)\)\s*$/i, '')
    .replace(/\s*[（(](?:续|接上|继续)[）)]\s*$/, '')
  return name.trim()
}

const SPEAKER_BLACKLIST = /^(?:内景|外景|内外景|场景|场次|镜头|画面|字幕|注|备注|音效|音乐|时间|地点|旁白说明|OS|VO)$/i

function isSpeakerLabel(value) {
  const name = normalizeCharacterName(value)
  if (!name || name.length > 16) return false
  if (SPEAKER_BLACKLIST.test(name)) return false
  if (/[。！？，,；;、]/.test(name)) return false
  return new RegExp(`^[${CJK}A-Za-z0-9·•.'’()（）\\s-]{1,16}$`).test(name)
}

export function isTransitionLine(value) {
  const text = String(value || '').trim().replace(/^>\s*/, '')
  return ENGLISH_TRANSITION_RE.test(text) ||
    /^(?:[—–-]+\s*)?(?:切至|切换|淡入|淡出|叠化|黑场|剧终|转场)(?:\s*[—–-]+)?$/.test(text) ||
    /^[（(](?:完|剧终)[）)]$/.test(text)
}

export function isSceneLine(value) {
  const text = String(value || '').trim().replace(/^\.\s*/, '')
  if (!text) return false
  if (ENGLISH_SCENE_RE.test(text)) return true
  if (/^\d+\s*[.)、．]\s*(?:INT|EXT|EST)\.?\b/i.test(text)) return true
  if (isHyphenSceneLine(text)) return true
  return /^【\s*(?:\d+|场景[一二三四五六七八九十百\d]+)\s*】\s*\S+/.test(text) ||
    // 「第N场」只有在后面接分隔符/空白/结尾时才算场景头，
    // 否则「第1场的动作描述。」这种正文会被误判成场景头
    /^(?:第\s*[一二三四五六七八九十百\d]+\s*场|场景\s*[一二三四五六七八九十百\d]+)(?:\s*[·.、:：\-—]|\s|$)/.test(text) ||
    /^\d+\s*[、.．]?\s*(?:内景|外景|内外景|内\/外)/.test(text) ||
    /^\d+\s*[、.．]\s*\S+.*(?:内景|外景|内外景|日|夜|晨|昏|晚)/.test(text) ||
    /^(?:内景|外景|内外景|内\/外)[\s·:：-]+\S+/.test(text)
}

const CN_SCENE_TYPE_SEG = /^(?:内景|外景|内外景|内外|内转外|外转内|内|外)$/
const CN_SCENE_TIME_SEG = /^(?:凌晨|深夜|午夜|夜晚|晚上|夜色|夜里|傍晚|黄昏|清晨|早晨|早上|黎明|中午|正午|下午|午后|白天|夜|日|晨|昏|晚)$/

// 中文常见的「地点-时间-内/外」场景头：殡仪馆走廊-夜-内、地铁站-日-内转外
function isHyphenSceneLine(text) {
  if (text.length > 30 || /[。！？；]/.test(text)) return false
  const segments = text.split(/[\s·\-—－–]+/).filter(Boolean)
  if (segments.length < 2 || segments.length > 5) return false
  return segments.some(seg => CN_SCENE_TYPE_SEG.test(seg)) &&
    segments.some(seg => CN_SCENE_TIME_SEG.test(seg))
}

export function isParentheticalLine(value) {
  const text = String(value || '').trim()
  if (!/^[（(].+[）)]$/.test(text)) return false
  const body = text.slice(1, -1).trim()
  if (/^(?:画外音|旁白|O\.?S\.?|V\.?O\.?|字幕)$/i.test(body)) return true
  // 带完整句号的括注通常是镜头/画面说明，按动作处理
  if (/[。！？；]/.test(body)) return false
  return body.length <= 30
}

function isPageBreakLine(line) {
  return line === '===' || line === '---' || /^[—–-]+\s*(?:PAGE BREAK|换页|分页)\s*[—–-]+$/i.test(line)
}

function isNoteLine(line) {
  return line.startsWith('/*') || line.startsWith('//') || line.startsWith('[注]') || line.startsWith('【注】')
}

function extractNote(line) {
  return line
    .replace(/^\/\*\s?/, '')
    .replace(/\s?\*\/$/, '')
    .replace(/^\/\//, '')
    .replace(/^\[注\]\s?/, '')
    .replace(/^【注】\s?/, '')
    .trim()
}

function isSceneDirectionPrefix(text) {
  return /^(?:画面|镜头|转场|场景)?\s*(?:来到|转到|切到|切至|转向|给到|切换到|转至|推向)[^。！？]*[。！？]?$/.test(String(text || '').trim())
}

// 行内嵌场景：「画面来到家里。内景-出租屋女生因为等他回家……」
function splitEmbeddedScene(line) {
  const match = String(line).match(/(内外景|内\/外|内景|外景)\s*[-－—–·:：]?\s*/)
  if (!match) return null

  const before = line.slice(0, match.index).trim()
  const after = line.slice(match.index + match[0].length).trim()
  if (!after) return null

  const loc = findLocation(after)
  if (!loc) return null

  const type = /内外景|内\/外/.test(match[1]) ? 'INT./EXT.' : match[1] === '外景' ? 'EXT' : 'INT'
  const time = findTime(after) || ''

  let rest = after
  if (rest.startsWith(loc.word)) rest = rest.slice(loc.word.length).trim()
  rest = rest
    .replace(/^[·•\-—–:：\s]*(?:凌晨|深夜|夜晚|晚上|傍晚|清晨|早晨|早上|白天|日|夜|晨|昏|晚)[·•\-—–:：\s，,]*/, '')
    .trim()

  return {
    before,
    rest,
    raw: `${type === 'EXT' ? 'EXT.' : 'INT.'} ${loc.name}${time ? ` - ${time}` : ''}`,
    meta: { type, location: loc.name, time },
  }
}

// 从叙述文字推断场景（只在出现明确地点时成立）
function inferSceneMeta(text, fallback = {}) {
  const loc = findLocation(text)
  const explicitType = /内外景|内\/外/.test(text) ? 'INT./EXT.' : /外景/.test(text) ? 'EXT' : /内景/.test(text) ? 'INT' : ''
  if (!loc && !explicitType) return null
  const type = explicitType || loc?.type || fallback.type || 'INT'
  const time = findTime(text) || fallback.time || ''
  return {
    type,
    location: loc?.name || fallback.location || '未命名场景',
    time,
  }
}

// 判断一段动作是否意味着换场
function isSceneShift(text, currentMeta) {
  if (!currentMeta || !text) return false
  const source = String(text).trim()

  const strong = /^(?:画面|镜头)(?:一转|一转场|来到|转到|切到|切至|推向|给到)|^(?:与此同时|另一边|另一头|另一方面|次日|翌日|第二天(?:一早|早上|清晨)?|当晚|那天晚上|深夜|凌晨)/.test(source)
  const inferred = inferSceneMeta(source, currentMeta)
  if (!inferred) return false
  if (inferred.location === currentMeta.location && normalizeSceneType(inferred.type) === normalizeSceneType(currentMeta.type)) return false

  const newSubject = /^(?:一个|一位|一群|一名|一男|一女)/.test(source)
  const outdoorMove = normalizeSceneType(currentMeta.type) !== 'EXT' &&
    normalizeSceneType(inferred.type) === 'EXT' &&
    /(?:走|跑|站|坐|来|回|出现|停|经过|路过|穿过)/.test(source)
  const different = inferred.location !== currentMeta.location
  const strongShift = strong && (different || (inferred.time && inferred.time !== currentMeta.time))

  return strongShift || (newSubject && different) || (newSubject && outdoorMove) || (outdoorMove && different)
}

function inferInitialMeta(blocks) {
  const sample = blocks
    .filter(b => b.type === ELEMENT_TYPES.ACTION)
    .slice(0, 4)
    .map(b => b.text)
    .join('\n')
  return inferSceneMeta(sample, {})
}

/* ============================================================
 *  角色识别：台词标签 + 叙述中的完整姓名
 * ============================================================ */

// 姓名后常见的谓语/停顿，用来判断二字/三字姓名边界
const PREDICATE_START = '说走站坐看拿回推转笑哭问答叹打发想把被在的是也和与就都却又才正要学会将已未不没从向对给跟到出进起下上开关摇醒睡等让叫望盯皱低抬伸握抓放靠躺蹲冲换穿脱收掏递接点喝吃煮热端骂喊吼抖颤扶拖抱拉按敲踢跪爬滚躲藏逃追赶来去来往'

function findFullNames(text, firstChar) {
  const candidates = new Set()
  for (let len = 2; len <= 3; len++) {
    const re = new RegExp(`${escapeRegExp(firstChar)}[${CJK}]{${len - 1}}`, 'g')
    let match
    while ((match = re.exec(text)) !== null) {
      const name = match[0]
      const next = text.charAt(match.index + name.length)
      const boundary = !next || /[\s，。！？、；：,.!?;:]/.test(next) || PREDICATE_START.includes(next)
      if (!boundary) continue
      if (name.length === 3 && PREDICATE_START.includes(name[2])) continue
      candidates.add(name)
    }
  }
  const two = [...candidates].filter(n => n.length === 2)
  if (two.length === 1) return two
  if (two.length > 1) return []
  const three = [...candidates].filter(n => n.length === 3)
  return three.length === 1 ? three : []
}

// 从台词标签推断完整姓名：顾 → 顾源，杨 → 杨桃安
function buildCastInfo(lines) {
  const labels = new Set()
  const narration = []

  lines.forEach(line => {
    const text = line.trim()
    if (!text) return
    const inline = text.match(/^([^：:]{1,20})[：:]\s*(.+)$/)
    if (inline) {
      const name = normalizeCharacterName(inline[1])
      if (isSpeakerLabel(name)) labels.add(name)
      else narration.push(text)
      return
    }
    if (/^【.+】$/.test(text) && !/^【\s*\d+\s*】/.test(text)) {
      const name = normalizeCharacterName(text)
      if (isSpeakerLabel(name)) labels.add(name)
      return
    }
    if (isSceneLine(text) || isTransitionLine(text) || isPageBreakLine(text) || isNoteLine(text) || isParentheticalLine(text)) return
    narration.push(text)
  })

  const aliasMap = {}
  const narrationText = narration.join('\n')
  labels.forEach(label => {
    if (label.length !== 1) return
    const names = findFullNames(narrationText, label)
    if (names.length === 1) aliasMap[label] = names[0]
  })

  return { aliasMap, cast: labels, narrationText }
}

function resolveSpeaker(name, aliasMap) {
  return aliasMap[name] || name
}

function looksLikeNarration(line) {
  const text = String(line || '').trim()
  return text.length > 40 && /[。！？]$/.test(text) && /^(?:她|他|她们|他们|众人|所有人|镜头|画面)/.test(text)
}

function isStandaloneCue(value, nextLine, cast) {
  const name = normalizeCharacterName(value)
  if (!isSpeakerLabel(name)) return false
  if (name.length > 12) return false
  if (LOCATION_NAMES.has(name)) return false
  if (/[.!?]$/.test(name)) return false // 以句号/问号结尾的是台词，不是角色名
  if (!nextLine || isSceneLine(nextLine) || isTransitionLine(nextLine) || isPageBreakLine(nextLine)) return false
  if (cast.has(name)) return true
  if (name.length < 2) return false
  return !looksLikeNarration(nextLine)
}

/* ============================================================
 *  主解析流程
 * ============================================================ */

function tokenize(lines, aliasMap, cast) {
  const blocks = []
  const push = (type, text = '', extra = {}) => blocks.push({ type, text, ...extra })
  let expectDialogue = false
  let dialogueStarted = false

  const nextNonEmpty = (from) => {
    for (let j = from + 1; j < lines.length; j++) {
      if (lines[j].trim()) return lines[j].trim()
    }
    return ''
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) {
      // 角色名与台词之间允许出现空行（DOCX 每个段落之间都有空行）。
      // 只有在已经读到台词之后，空行才表示对白结束。
      if (!(expectDialogue && !dialogueStarted)) {
        expectDialogue = false
        dialogueStarted = false
      }
      continue
    }

    if (SCENE_NUMBER_ONLY_RE.test(line)) continue

    if (isPageBreakLine(line)) {
      push(ELEMENT_TYPES.PAGE_BREAK)
      expectDialogue = false
      continue
    }

    if (isNoteLine(line)) {
      push(ELEMENT_TYPES.NOTE, extractNote(line))
      expectDialogue = false
      continue
    }

    // 幕结构 / 镜头 / 小标题：必须先于转场判断（END OF ACT 不能被当成 END OF ... 转场）
    if (TEASER_RE.test(line)) {
      push(ELEMENT_TYPES.TEASER, line)
      expectDialogue = false
      continue
    }
    if (END_ACT_RE.test(line)) {
      push(ELEMENT_TYPES.END_ACT, line)
      expectDialogue = false
      continue
    }
    if (ACT_RE.test(line)) {
      push(ELEMENT_TYPES.ACT, line)
      expectDialogue = false
      continue
    }
    if (SUBHEADING_RE.test(line)) {
      push(ELEMENT_TYPES.SUBHEADING, line.replace(/^#{1,6}\s+/, '').replace(/^〔|〕$/g, ''))
      expectDialogue = false
      continue
    }
    if (EN_SHOT_RE.test(line) || CN_SHOT_RE.test(line)) {
      push(ELEMENT_TYPES.SHOT, line.replace(/^#{1,6}\s+/, ''))
      expectDialogue = false
      continue
    }

    if (isTransitionLine(line)) {
      push(ELEMENT_TYPES.TRANSITION, line.replace(/^>\s*/, '').trim())
      expectDialogue = false
      continue
    }

    // 纯场景行：短、无句末标点
    if (line.length <= 24 && !/[。！？；]/.test(line) && isSceneLine(line)) {
      const meta = parseSceneMeta(line)
      if (meta) {
        push(ELEMENT_TYPES.SLUGLINE, line, { meta })
        expectDialogue = false
        continue
      }
    }

    // 行内嵌场景
    const embedded = splitEmbeddedScene(line)
    if (embedded) {
      if (embedded.before && !isSceneDirectionPrefix(embedded.before)) {
        push(ELEMENT_TYPES.ACTION, embedded.before)
      }
      push(ELEMENT_TYPES.SLUGLINE, embedded.raw, { meta: embedded.meta })
      if (embedded.rest) push(ELEMENT_TYPES.ACTION, embedded.rest)
      expectDialogue = false
      continue
    }

    // 长场景行（含句号）
    if (isSceneLine(line)) {
      const meta = parseSceneMeta(line)
      if (meta) {
        push(ELEMENT_TYPES.SLUGLINE, line, { meta })
        expectDialogue = false
        continue
      }
    }

    // 括号提示：必须先于角色行判断，(hesitant) 这类不能被当成角色
    if (isParentheticalLine(line)) {
      push(ELEMENT_TYPES.PARENTHETICAL, line)
      continue
    }

    // 双人对话：角色名以 ^ 结尾（Fountain 语法）
    const dualCue = line.match(/^(.{1,20}?)\s*\^$/)
    if (dualCue) {
      const speaker = normalizeCharacterName(dualCue[1])
      if (isSpeakerLabel(speaker)) {
        push(ELEMENT_TYPES.CHARACTER, resolveSpeaker(speaker, aliasMap), { dualCue: true })
        expectDialogue = true
        continue
      }
    }

    // 同一行的「角色：台词」
    // 已在某角色的对白里时不再切分，否则长独白里出现冒号会被误拆成新角色
    const inline = !expectDialogue && line.match(/^([^：:]{1,20})[：:]\s*(.+)$/)
    if (inline) {
      const speaker = normalizeCharacterName(inline[1])
      if (isSpeakerLabel(speaker) && !isSceneLine(speaker)) {
        push(ELEMENT_TYPES.CHARACTER, resolveSpeaker(speaker, aliasMap))
        push(ELEMENT_TYPES.DIALOGUE, inline[2].trim())
        expectDialogue = false
        continue
      }
    }

    // 独立角色行 + 下一行台词
    if (isStandaloneCue(line, nextNonEmpty(i), cast)) {
      push(ELEMENT_TYPES.CHARACTER, resolveSpeaker(normalizeCharacterName(line), aliasMap))
      expectDialogue = true
      dialogueStarted = false
      continue
    }

    if (expectDialogue && !looksLikeNarration(line)) {
      push(ELEMENT_TYPES.DIALOGUE, line)
      dialogueStarted = true
      continue
    }

    expectDialogue = false
    push(ELEMENT_TYPES.ACTION, line)
  }

  return blocks
}

function mergeDualDialogue(blocks) {
  const out = []
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (block.type !== ELEMENT_TYPES.CHARACTER || !block.dualCue) {
      out.push(block)
      continue
    }

    const left = { name: block.text, lines: [] }
    let j = i + 1
    while (j < blocks.length && (blocks[j].type === ELEMENT_TYPES.PARENTHETICAL || blocks[j].type === ELEMENT_TYPES.DIALOGUE)) {
      left.lines.push(blocks[j]); j++
    }

    const rightBlock = blocks[j]
    if (left.lines.length && rightBlock?.type === ELEMENT_TYPES.CHARACTER) {
      const right = { name: rightBlock.text, lines: [] }
      let k = j + 1
      while (k < blocks.length && (blocks[k].type === ELEMENT_TYPES.PARENTHETICAL || blocks[k].type === ELEMENT_TYPES.DIALOGUE)) {
        right.lines.push(blocks[k]); k++
      }
      if (right.lines.length) {
        const flat = (part) => part.lines.map(line => line.text).join(' ')
        out.push({
          type: ELEMENT_TYPES.DUAL_DIALOGUE,
          text: `${left.name}：${flat(left)} ／ ${right.name}：${flat(right)}`,
          dual: { left, right },
        })
        i = k - 1
        continue
      }
    }

    // 没找到配对的右侧角色，按普通角色行退回
    delete block.dualCue
    out.push(block, ...left.lines)
    i = j - 1
  }
  return out
}

function groupScenes(blocks, initialMeta) {
  const scenes = []
  let current = { meta: initialMeta || null, blocks: [] }

  const flush = () => {
    if (current.blocks.length) scenes.push(current)
    current = { meta: null, blocks: [] }
  }

  blocks.forEach(block => {
    if (block.type === ELEMENT_TYPES.SLUGLINE) {
      if (current.blocks.length) flush()
      current.meta = block.meta || current.meta
      return
    }

    if (block.type === ELEMENT_TYPES.ACTION && current.meta && current.blocks.length) {
      if (isSceneShift(block.text, current.meta)) {
        flush()
        current.meta = inferSceneMeta(block.text, {}) || null
        current.blocks.push(block)
        return
      }
    }

    current.blocks.push(block)
  })

  if (current.blocks.length) scenes.push(current)

  // 没有场景头但有内容的场景，用正文兜底推断
  scenes.forEach(scene => {
    if (!scene.meta) {
      const sample = scene.blocks
        .filter(b => b.type === ELEMENT_TYPES.ACTION)
        .slice(0, 4)
        .map(b => b.text)
        .join('\n')
      scene.meta = inferSceneMeta(sample, {})
    }
  })

  return scenes
}

function scenesToElements(scenes, formatId) {
  const elements = []
  let sceneNumber = 0

  scenes.forEach(scene => {
    if (!scene.blocks.length) return
    if (scene.meta) {
      sceneNumber++
      elements.push({
        id: nanoid(),
        type: ELEMENT_TYPES.SLUGLINE,
        text: renderSlugline(scene.meta, formatId, sceneNumber),
        meta: scene.meta,
      })
    }
    scene.blocks.forEach(block => {
      elements.push({
        id: nanoid(),
        type: block.type,
        text: block.text,
        ...(block.dual ? { dual: block.dual } : {}),
      })
    })
  })

  return elements
}

/**
 * 把任意纯文本识别成剧本结构。
 * @param {string} text 原始文本
 * @param {string} formatId 当前模板，用于决定场景头的显示形态
 */
export function parseScriptText(text, formatId = 'hollywood') {
  const source = cleanText(text)
  if (!source.trim()) return []

  const lines = source.split('\n')
  const { aliasMap, cast } = buildCastInfo(lines)
  const blocks = mergeDualDialogue(tokenize(lines, aliasMap, cast))

  let initialMeta = null
  if (blocks[0]?.type === ELEMENT_TYPES.SLUGLINE) {
    initialMeta = blocks[0].meta
  } else {
    initialMeta = inferInitialMeta(blocks)
  }

  const scenes = groupScenes(blocks, initialMeta)
  return scenesToElements(scenes, formatId)
}

/* ============================================================
 *  序列化：结构 → 指定模板文本
 * ============================================================ */

function formatSlugline(element, formatId, sceneNumber) {
  const meta = element.meta || parseSceneMeta(element.text)
  if (!meta) {
    return formatId === 'free' ? element.text.trim() : smartUpper(element.text.trim())
  }
  return renderSlugline(meta, formatId, sceneNumber)
}

function formatCharacter(text, formatId, continued = false) {
  const preset = getPresetById(formatId)
  const name = normalizeCharacterName(text)
  if (preset.family === 'chinese') return `【${name}】`
  if (formatId === 'free') return name
  const upper = smartUpper(name)
  return formatId === 'netflix' && continued ? `${upper} (CONT'D)` : upper
}

function formatParenthetical(text, formatId) {
  const preset = getPresetById(formatId)
  const value = String(text || '').trim().replace(/^[（(]\s*/, '').replace(/\s*[）)]$/, '')
  return preset.family === 'chinese' ? `（${value}）` : `(${value})`
}

function formatTransition(text, formatId) {
  const preset = getPresetById(formatId)
  let value = String(text || '').trim().replace(/^>\s*/, '').replace(/^[—–-]+\s*|\s*[—–-]+$/g, '').trim()
  const normalized = value.replace(/^[（(]|[）)]$/g, '')
  const upper = normalized.toUpperCase().replace(/[.:]$/, '')
  const toCn = { 'CUT TO': '切至', 'FADE IN': '淡入', 'FADE OUT': '淡出', 'DISSOLVE TO': '叠化', 'FADE TO BLACK': '黑场', 'THE END': '剧终', '完': '剧终', '剧终': '剧终' }
  const toEn = { '切至': 'CUT TO:', '切换': 'CUT TO:', '淡入': 'FADE IN.', '淡出': 'FADE OUT.', '叠化': 'DISSOLVE TO:', '黑场': 'FADE TO BLACK.', '完': 'THE END', '剧终': 'THE END' }

  if (preset.family === 'chinese') return `—— ${toCn[upper] || normalized} ——`
  value = toEn[normalized] || smartUpper(normalized)
  return formatId === 'fountain' ? `> ${value}` : value
}

export function serializeScript(elements, formatId = 'hollywood') {
  if (!Array.isArray(elements) || !elements.length) return ''
  const lines = []
  let slugCounter = 0
  let lastSpeaker = ''

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]
    const next = elements[i + 1]

    switch (el.type) {
      case ELEMENT_TYPES.SLUGLINE: {
        slugCounter++
        lastSpeaker = ''
        if (lines.length && lines.at(-1) !== '') lines.push('')
        lines.push(formatSlugline(el, formatId, slugCounter))
        if (next) lines.push('')
        break
      }

      case ELEMENT_TYPES.CHARACTER: {
        const name = normalizeCharacterName(el.text)
        const continued = formatId === 'netflix' && !!lastSpeaker && name === lastSpeaker
        if (lines.length && lines.at(-1) !== '') lines.push('')
        lines.push(formatCharacter(el.text, formatId, continued))
        lastSpeaker = name
        break
      }

      case ELEMENT_TYPES.PARENTHETICAL:
        lines.push(formatParenthetical(el.text, formatId))
        break

      case ELEMENT_TYPES.DIALOGUE:
        lines.push(String(el.text || '').trim())
        if (next && next.type !== ELEMENT_TYPES.PARENTHETICAL && next.type !== ELEMENT_TYPES.DIALOGUE) lines.push('')
        break

      case ELEMENT_TYPES.TRANSITION:
        if (lines.length && lines.at(-1) !== '') lines.push('')
        lines.push(formatTransition(el.text, formatId))
        if (next) lines.push('')
        break

      case ELEMENT_TYPES.TITLE: {
        if (lines.length && lines.at(-1) !== '') lines.push('')
        lines.push(String(el.text || '').trim())
        if (next) lines.push('')
        break
      }

      case ELEMENT_TYPES.TEASER:
      case ELEMENT_TYPES.ACT:
      case ELEMENT_TYPES.END_ACT: {
        const preset = getPresetById(formatId)
        if (lines.length && lines.at(-1) !== '') lines.push('')
        const raw = String(el.text || '').trim().replace(/[.:]$/, '')
        const value = preset.family === 'chinese' ? raw : smartUpper(raw)
        lines.push(formatId === 'fountain' ? `## ${value}` : value)
        if (next) lines.push('')
        break
      }

      case ELEMENT_TYPES.SHOT: {
        const preset = getPresetById(formatId)
        if (lines.length && lines.at(-1) !== '') lines.push('')
        const raw = String(el.text || '').trim()
        lines.push(preset.family === 'chinese' ? raw : smartUpper(raw))
        break
      }

      case ELEMENT_TYPES.SUBHEADING: {
        if (lines.length && lines.at(-1) !== '') lines.push('')
        const raw = String(el.text || '').trim().replace(/^#{1,6}\s+/, '').replace(/^〔|〕$/g, '')
        lines.push(formatId === 'fountain' ? `## ${raw}` : raw)
        break
      }

      case ELEMENT_TYPES.DUAL_DIALOGUE: {
        if (!el.dual) {
          if (lines.length && lines.at(-1) !== '') lines.push('')
          lines.push(String(el.text || '').trim())
          break
        }
        const preset = getPresetById(formatId)
        const writeColumn = (part, index) => {
          const cue = formatCharacter(part.name, formatId)
          lines.push(index === 0 ? `${cue} ^` : cue)
          part.lines.forEach(line => {
            lines.push(line.type === ELEMENT_TYPES.PARENTHETICAL
              ? formatParenthetical(line.text, formatId)
              : String(line.text || '').trim())
          })
        }
        if (lines.length && lines.at(-1) !== '') lines.push('')
        writeColumn(el.dual.left, 0)
        lines.push('')
        writeColumn(el.dual.right, 1)
        lastSpeaker = ''
        break
      }

      case ELEMENT_TYPES.PAGE_BREAK:
        if (lines.length && lines.at(-1) !== '') lines.push('')
        lines.push(formatId === 'fountain' ? '===' : formatId === 'cn-gov' ? '———— 换页 ————' : '— PAGE BREAK —')
        if (next) lines.push('')
        break

      case ELEMENT_TYPES.NOTE:
        if (lines.length && lines.at(-1) !== '') lines.push('')
        lines.push(formatId === 'fountain' ? `/* ${String(el.text || '').trim()} */` : `[注] ${String(el.text || '').trim()}`)
        if (next) lines.push('')
        break

      case ELEMENT_TYPES.ACTION:
      default: {
        const value = String(el.text || '').trim()
        if (!value) break
        if (lines.length && lines.at(-1) !== '') lines.push('')
        lines.push(value)
        break
      }
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * 一步到位：任意文本 → 指定模板的专业排版文本
 */
export function formatScriptText(text, formatId = 'hollywood') {
  return serializeScript(parseScriptText(text, formatId), formatId)
}

/* ============================================================
 *  校验与统计
 * ============================================================ */

export function validateFormat(elements, preset) {
  const issues = []
  const warnings = []
  if (!preset || !Array.isArray(elements)) return { issues, warnings }

  elements.forEach((el, idx) => {
    if (el.type === ELEMENT_TYPES.SLUGLINE) {
      if (preset.id === 'cn-gov') {
        if (!/[内外景]/.test(el.text)) {
          warnings.push({ id: nanoid(), type: 'warning', element: el, message: '场景标题应包含「内景/外景」标记' })
        }
        if (!/[日夜晚晨昏]/.test(el.text)) {
          warnings.push({ id: nanoid(), type: 'warning', element: el, message: '场景标题应包含时间（日/夜/晨/昏）' })
        }
      } else if (preset.sluglinePatterns && preset.sluglinePatterns.length > 0) {
        const normalized = String(el.text || '').replace(/^\d+\s*[.)、．]\s*/, '')
        if (!preset.sluglinePatterns.some(p => normalized.toUpperCase().startsWith(p.toUpperCase()))) {
          warnings.push({ id: nanoid(), type: 'warning', element: el, message: `场景标题应以 ${preset.sluglinePatterns.join('/')} 开头` })
        }
        if (preset.slugline?.uppercase && normalized !== normalized.toUpperCase()) {
          issues.push({ id: nanoid(), type: 'error', element: el, message: '场景标题应为全大写' })
        }
      }
    }

    if (el.type === ELEMENT_TYPES.CHARACTER) {
      if (preset.id !== 'cn-gov' && preset.character?.uppercase && el.text !== el.text.toUpperCase()) {
        issues.push({ id: nanoid(), type: 'error', element: el, message: '角色名应为全大写' })
      }
    }

    if (el.type === ELEMENT_TYPES.DIALOGUE) {
      const prev = elements[idx - 1]
      if (prev && prev.type !== ELEMENT_TYPES.CHARACTER && prev.type !== ELEMENT_TYPES.PARENTHETICAL) {
        issues.push({ id: nanoid(), type: 'error', element: el, message: '对话前必须先有角色名' })
      }
    }
  })

  return { issues, warnings }
}

export function extractCharacters(elements) {
  const chars = new Set()
  ;(elements || []).forEach(el => {
    if (el.type === ELEMENT_TYPES.CHARACTER) chars.add(el.text.toUpperCase())
    if (el.type === ELEMENT_TYPES.DUAL_DIALOGUE && el.dual) {
      chars.add(String(el.dual.left?.name || '').toUpperCase())
      chars.add(String(el.dual.right?.name || '').toUpperCase())
    }
  })
  chars.delete('')
  return Array.from(chars)
}

// 去掉空白后的字符数（中文按字、英文按字符，用于对白/动作占比）
function measureChars(text) {
  return String(text || '').replace(/\s/g, '').length
}

// 句子数：按中英文标点切分，空文本返回 0
function countSentences(text) {
  const parts = String(text || '')
    .split(/[。！？!?；;…\n]+/)
    .map(s => s.trim())
    .filter(Boolean)
  return parts.length
}

export function getScriptStats(elements, preset) {
  const list = Array.isArray(elements) ? elements : []
  const sluglines = list.filter(e => e.type === ELEMENT_TYPES.SLUGLINE).length
  const characters = extractCharacters(list)
  const dialogueCount = list.filter(e => e.type === ELEMENT_TYPES.DIALOGUE).length
  const actionWords = list
    .filter(e => e.type === ELEMENT_TYPES.ACTION)
    .reduce((sum, e) => sum + (e.text || '').split(/\s+/).filter(Boolean).length, 0)

  // ---- 对白分析 ----
  const characterStats = {}
  let dialogueChars = 0
  let dialogueSentences = 0
  let currentCharacter = ''
  let speech = { name: '', chunks: [] }
  let longestMonologue = { character: '', text: '', chars: 0 }

  const flushSpeech = () => {
    const text = speech.chunks.join(' ').trim()
    const len = measureChars(text)
    if (len > longestMonologue.chars) {
      longestMonologue = { character: speech.name || '未标注', text, chars: len }
    }
    speech = { name: '', chunks: [] }
  }

  const addDialogue = (name, text) => {
    const len = measureChars(text)
    if (!len) return
    const key = name || '未标注'
    dialogueChars += len
    dialogueSentences += countSentences(text)
    if (!characterStats[key]) characterStats[key] = { name: key, chars: 0, lines: 0 }
    characterStats[key].chars += len
    characterStats[key].lines += 1
  }

  list.forEach(el => {
    if (el.type === ELEMENT_TYPES.CHARACTER) {
      flushSpeech()
      currentCharacter = String(el.text || '').replace(/^【|】$/g, '').replace(/\(.*?\)/g, '').trim()
      return
    }
    if (el.type === ELEMENT_TYPES.DIALOGUE) {
      if (speech.name && speech.name !== currentCharacter) flushSpeech()
      speech.name = currentCharacter || speech.name
      speech.chunks.push(String(el.text || ''))
      addDialogue(currentCharacter, el.text)
      return
    }
    if (el.type === ELEMENT_TYPES.DUAL_DIALOGUE && el.dual) {
      flushSpeech()
      ;[el.dual.left, el.dual.right].forEach(part => {
        const text = (part?.lines || [])
          .filter(line => line.type === ELEMENT_TYPES.DIALOGUE)
          .map(line => line.text)
          .join(' ')
        if (!measureChars(text)) return
        addDialogue(part?.name, text)
        if (measureChars(text) > longestMonologue.chars) {
          longestMonologue = { character: part?.name || '未标注', text: text.trim(), chars: measureChars(text) }
        }
      })
      return
    }
    // 动作、场景头、转场等打断独白
    flushSpeech()
  })
  flushSpeech()

  const actionChars = list
    .filter(e => e.type === ELEMENT_TYPES.ACTION)
    .reduce((sum, e) => sum + measureChars(e.text), 0)

  const totalBody = dialogueChars + actionChars
  const dialogueRatio = totalBody ? dialogueChars / totalBody : 0

  const characterStatsList = Object.values(characterStats)
    .sort((a, b) => b.chars - a.chars)
    .map(item => ({
      ...item,
      ratio: dialogueChars ? item.chars / dialogueChars : 0,
    }))

  const estimatedPages = Math.max(1, Math.ceil(list.length / 55))

  return {
    scenes: sluglines,
    characters: characters.length,
    characterList: characters,
    dialogueLines: dialogueCount,
    actionWords,
    actionChars,
    dialogueChars,
    dialogueRatio,
    avgSentenceLength: dialogueSentences ? Math.round(dialogueChars / dialogueSentences) : 0,
    characterStats: characterStatsList,
    longestMonologue,
    estimatedPages,
    estimatedMinutes: preset?.pageTiming?.includes('1 page') ? estimatedPages : null,
  }
}
