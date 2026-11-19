// 真实分页引擎
//
// 不估算行数：把编辑器实际使用的 HTML（同一份 decorateEditorHtml 输出）
// 放进一个等宽、等字体、等行距的隐藏容器里量高度，按每个段落的真实行盒
// 计算可断页位置，再套 keep-together 规则。
//
// 编辑区与预览消费同一个 paginateDocument 结果：预览按页裁剪同一段 HTML，
// 编辑区在同一 Y 坐标画断页线，所以两边页数与断页位置必然一致。

const UNIT_PX = { px: 1, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, pt: 96 / 72 }

export function toPx(value, unit = 'px') {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return n * (UNIT_PX[unit] || 1)
}

/** 纸张、页边距与正文区尺寸（px） */
export function pageMetrics(format) {
  const page = format?.page || {}
  const margins = format?.margins || {}
  const pageUnit = page.unit || 'in'
  const marginUnit = margins.unit || pageUnit
  const pageW = toPx(page.width || 8.5, pageUnit)
  const pageH = toPx(page.height || 11, pageUnit)
  const left = toPx(margins.left ?? 1, marginUnit)
  const right = toPx(margins.right ?? 1, marginUnit)
  const top = toPx(margins.top ?? 1, marginUnit)
  const bottom = toPx(margins.bottom ?? 1, marginUnit)
  return {
    pageW,
    pageH,
    left,
    right,
    top,
    bottom,
    contentW: Math.max(80, pageW - left - right),
    contentH: Math.max(80, pageH - top - bottom),
  }
}

// 可以跨页切断、需要续接标记的块
const SPLITTABLE = new Set(['action', 'dialogue', 'parenthetical', 'shot', 'note', 'subheading', 'blank'])
// 绝不能单独留在页底 / 被切断的块
const KEEP_WITH_NEXT = new Set(['slugline', 'character', 'act', 'teaser', 'endact', 'pagebreak'])

function blockType(el) {
  const cls = String(el.className || '').split(/\s+/)
  const found = cls.find(c => c && c !== 'script-el' && c !== 'blank')
  if (found) return found
  return 'action'
}

/**
 * 测量并分页
 * @param {string} html decorateEditorHtml 的输出
 * @param {object} format 模板
 * @param {object} options { fontSizePx }
 * @returns {{pages, totalPages, contentW, contentH, pageW, pageH, totalHeight}}
 */
export function paginateDocument(html, format, options = {}) {
  const metrics = pageMetrics(format)
  const pageStyle = {}
  // 与编辑区完全相同的排版度量
  const fontFamily = options.fontFamily || format?.font?.family || 'Courier Prime'
  const fontSize = options.fontSizePx
    ? `${options.fontSizePx}px`
    : `${Number(format?.font?.sizePt) || 12}pt`
  const lineHeight = format?.lineHeightPt ? `${format.lineHeightPt}pt` : String(format?.lineHeight || 1.15)

  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  Object.assign(host.style, {
    position: 'fixed',
    left: '-20000px',
    top: '0',
    width: `${metrics.contentW}px`,
    fontFamily,
    fontSize,
    lineHeight,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    visibility: 'hidden',
    pointerEvents: 'none',
    margin: '0',
    padding: '0',
  })
  host.innerHTML = html || ''
  document.body.appendChild(host)

  const els = [...host.children]
  const blocks = els.map((el, index) => {
    const cs = getComputedStyle(el)
    const lh = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) || 16) * 1.2
    const height = el.offsetHeight
    return {
      index,
      type: blockType(el),
      isBlank: el.classList.contains('blank'),
      top: el.offsetTop,
      height,
      lineH: lh,
      lines: Math.max(1, Math.round(height / lh)),
      text: (el.innerText || '').trim(),
    }
  })
  const totalHeight = blocks.length
    ? blocks[blocks.length - 1].top + blocks[blocks.length - 1].height
    : host.scrollHeight
  host.remove()

  // 候选断页点：可切块按行断，其他块只在段落底部断
  const cuts = []
  blocks.forEach(block => {
    if (block.type === 'pagebreak') {
      cuts.push({ y: block.top, block, line: 0, forced: true })
      return
    }
    if (SPLITTABLE.has(block.type)) {
      for (let k = 1; k <= block.lines; k++) {
        // 行高取整可能略大于实测高度，夹到段落底部，避免断点落入下一段
        cuts.push({ y: block.top + Math.min(k * block.lineH, block.height), block, line: k })
      }
    } else {
      cuts.push({ y: block.top + block.height, block, line: block.lines })
    }
  })
  cuts.sort((a, b) => a.y - b.y)

  const { contentH } = metrics
  const pages = []
  let start = 0
  let guard = 0

  while (start < totalHeight - 0.5 && guard < 500) {
    guard += 1
    const limit = start + contentH

    // 剩余内容一页装得下：收尾，不再制造一条几乎空白的尾页
    if (totalHeight <= limit + 0.5) {
      pages.push({
        index: pages.length,
        number: pages.length + 1,
        start,
        end: totalHeight,
        continued: false,
        inDialogue: false,
        forced: false,
        blockIndex: null,
      })
      start = totalHeight
      break
    }

    // 该页内最靠后的合法断点（pagebreak 元素在版面上会被当作强制断点）
    let cut = null
    for (const c of cuts) {
      if (c.y > limit + 0.5) break
      if (c.y > start + 1) cut = c
    }
    if (!cut) {
      cut = { y: limit, block: null, line: 0, forced: true }
    }

    // keep-together：角色名/场景头不能孤零零留在页底
    cut = adjustKeepTogether(cut, blocks, limit, start, cut.forced)
    if (cut.y <= start + 1) cut = { y: limit, block: null, line: 0, forced: true }

    const inDialogue = !!cut.block && cut.block.type === 'dialogue' && cut.line > 0 && cut.line < cut.block.lines
    pages.push({
      index: pages.length,
      number: pages.length + 1,
      start,
      end: cut.y,
      continued: inDialogue,
      inDialogue,
      forced: !!cut.forced,
      blockIndex: cut.block ? cut.block.index : null,
    })
    start = cut.y
  }

  // 只有一页也返回一页；空文档也保证至少一页
  if (!pages.length) {
    pages.push({ index: 0, number: 1, start: 0, end: Math.max(totalHeight, contentH), continued: false, inDialogue: false })
  }

  // 每个断页点对应的续接信息
  pages.forEach((pg, i) => {
    pg.hasNext = i < pages.length - 1
    pg.contd = i > 0 && pages[i - 1].inDialogue
  })

  return {
    pages,
    totalPages: pages.length,
    totalHeight,
    contentW: metrics.contentW,
    contentH: metrics.contentH,
    pageW: metrics.pageW,
    pageH: metrics.pageH,
    metrics,
  }
}

function adjustKeepTogether(cut, blocks, limit, start, forced) {
  if (forced) return cut
  const ended = cut.block
  if (!ended) return cut
  const prev = blocks.filter(b => b.index < ended.index).slice(-1)[0] || null
  const next = blocks.find(b => b.index === ended.index + 1) || null

  const at = (block) => (block && block.top > start + 1
    ? { y: block.top, block, line: 0, forced: false }
    : null)

  // 向后看：跳过空白/括号提示，判断紧随其后的正文第一行能否留在本页
  const cueFitsThrough = (from) => {
    let b = from
    let guard = 0
    while (b && guard < 6 && (b.type === 'parenthetical' || b.isBlank)) {
      if (b.top + b.lineH > limit + 0.5) return false
      b = blocks.find(x => x.index === b.index + 1)
      guard += 1
    }
    if (!b) return true
    return b.top + b.lineH <= limit + 0.5
  }

  // 对白所在的角色名 / 括号提示链的起点（换页时整条一起走）
  const cueStart = (block) => {
    let p = blocks.find(b => b.index === block.index - 1)
    let guard = 0
    while (p && p.isBlank && guard < 4) {
      p = blocks.find(b => b.index === p.index - 1)
      guard += 1
    }
    if (!p) return block
    if (p.type === 'parenthetical') {
      let pp = blocks.find(b => b.index === p.index - 1)
      let g2 = 0
      while (pp && pp.isBlank && g2 < 4) {
        pp = blocks.find(b => b.index === pp.index - 1)
        g2 += 1
      }
      if (pp && pp.type === 'character') return pp
      return p
    }
    if (p.type === 'character') return p
    return block
  }

  // 对白只留 1 行在页底 → 连角色名一起推到下一页
  if (ended.type === 'dialogue' && cut.line === 1) {
    return at(cueStart(ended)) || cut
  }
  // 对白下一页只剩 1 行 → 上移一行，避免孤行
  if (ended.type === 'dialogue' && cut.line === ended.lines - 1 && ended.lines > 2) {
    return { y: ended.top + (cut.line - 1) * ended.lineH, block: ended, line: cut.line - 1, forced: false }
  }

  // 角色名结束在页底，而对白第一行放不下 → 角色名整体移到下一页
  if (ended.type === 'character' && !cueFitsThrough(next)) {
    return at(ended) || cut
  }
  // 括号提示结束在页底，对白放不下 → 从角色名开始整体移走
  if (ended.type === 'parenthetical' && prev && prev.type === 'character' && !cueFitsThrough(next)) {
    return at(prev) || cut
  }
  // 场景头结束在页底，下一段第一行放不下 → 场景头移到下一页
  if (ended.type === 'slugline' && !cueFitsThrough(next)) {
    return at(ended) || cut
  }
  return cut
}

/** MORE / (CONT'D) 只在真正跨页的对白上出现 */
export function continuationMarks(pagination) {
  if (!pagination) return { more: 0, contd: 0 }
  return {
    more: pagination.pages.filter(p => p.continued).length,
    contd: pagination.pages.filter(p => p.contd).length,
  }
}
