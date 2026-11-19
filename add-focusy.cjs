// 给 artLibrary.js 每条加 focusY 字段
const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, 'src', 'utils', 'artLibrary.js')
let code = fs.readFileSync(src, 'utf8')

// 1. 去掉已有的 focusY 字段（避免重复）
code = code.replace(/,\s*focusY:\s*\d+/g, '')

// 2. 正则捕获每个带 thumb 的 id block
const blockRe = /id:\s*'([^']+)',[\s\S]*?thumb:\s*'[^']+',\s*\n/g

const lookup = {
  // 横构图（ratio>=1.25）→ 50；竖构图（ratio<=0.8）→ 34（焦点上提不卡头）
  // 下面是人工校正：按每幅画的主体位置覆盖默认
  'friedrich-fog': 62,       // 雾海漫游者：主角背影在下方悬崖
  'ukiyoe-wave': 55,         // 神奈川冲浪里：浪在下方
  'picasso-guernica': 42,    // 格尔尼卡：黑马脸在左上更出名
  'goya-dark': 52,           // 1808年5月3日：行刑线在中下方
  'vangogh-sunflowers': 44,
  'vangogh-roses': 44,
  'vermeer-pearl': 38,
  'raphael-madonna': 40,
  'titian-assumption': 40,
  'de-hoch-interior': 55,
  'chinese-ink': 30,         // 谿山行旅图：山在顶部
  'rembrandt': 38,
  'botticelli-venus': 50,
  'delacroix-liberty': 50,
  'goya-dark': 52,
  'hokusai-fuji': 45,        // 赤富士：太阳在上方，山在下方
  'impression-landscape': 50,
  'japan-temple': 42,
  'kandinsky': 50,
  'mondrian': 50,
  'monet-lilies': 50,
  'monet-poppies': 50,
  'monet-san-giorgio': 50,
  'renaissance-interior': 50,
  'turner-rain': 50,
  'vangogh-almond': 46,
  'vangogh-irises': 50,
  'vangogh-potatoes': 50,
  'vermeer-pearl': 38,
  'asian-paper': 50,
  'baroque-chiaroscuro': 50,
  'degas-dancers': 48,
  'gauguin-tahiti': 44,
}

// 默认算法：竖构图(ratio<=0.8)→34，横构图(>=1.25)→50，近方→45
const defaultFyForRatio = (id) => {
  // 查不到时给 45
  return lookup[id] ?? 45
}

// 收集所有 thumb 行的 index
const thumbLineRe = /(\s*)(thumb:\s*'[^']+',\s*\n)/g
const edits = []
let m
while ((m = thumbLineRe.exec(code)) !== null) {
  // 向前找最近的 id:
  const chunkBefore = code.slice(Math.max(0, m.index - 400), m.index)
  const idMatch = chunkBefore.match(/id:\s*'([^']+)'[^}]*$/) || chunkBefore.match(/id:\s*'([^']+)'[\s\S]*$/)
  const idChunk = code.slice(Math.max(0, m.index - 400), m.index)
  const idMatch2 = idChunk.match(/id:\s*'([^']+)'/)
  if (!idMatch2) continue
  const id = idMatch2[1]
  const fy = defaultFyForRatio(id)
  edits.push({ afterIndex: m.index + m[0].length, fy })
}

// 倒序插入
edits.sort((a, b) => b.afterIndex - a.afterIndex)
for (const e of edits) {
  code = code.slice(0, e.afterIndex) + `    focusY: ${e.fy},\n` + code.slice(e.afterIndex)
}

fs.writeFileSync(src, code)
console.log(`✅ 写入 ${edits.length} 条 focusY`)
