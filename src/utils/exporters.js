// 导出工具 - PDF / Fountain / DOCX / HTML
// 所有导出器均 FORMAT-PRESET AWARE：读取 preset 的 page size / font / margins / lineHeight / indent 等，
// 保证 PDF / DOCX / HTML 和编辑器里看到的完全一致。

import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx'
import { getPresetById } from '../config/formatPresets.js'
import { serializeScript } from './scriptParser.js'
import { getActivePaper } from './paperLibrary.js'

// ============ 统一保存：Electron 原生另存为对话框 ============
// 本软件是 Electron 桌面应用，preload.cjs 必然注入 window.electronAPI
/**
 * @param {Blob} blob - 要保存的数据
 * @param {string} defaultName - 默认文件名（含扩展名）
 * @param {Array<{name:string, extensions:string[]}>} filters - 文件类型过滤器
 * @returns {Promise<{ok:boolean, saved:boolean, filePath?:string, error?:string}>}
 */
export async function saveBlob(blob, defaultName, filters) {
  try {
    const { canceled, filePath } = await window.electronAPI.saveDialog({ defaultPath: defaultName, filters })
    if (canceled) return { ok: true, saved: false }
    const ab = await blob.arrayBuffer()
    const result = await window.electronAPI.writeFile(filePath, ab)
    if (!result.ok) return { ok: false, saved: false, error: result.error }
    return { ok: true, saved: true, filePath }
  } catch (err) {
    return { ok: false, saved: false, error: String(err?.message || err) }
  }
}

// 取当前稿纸的 background CSS 片段（供导出 DOM node 和 html2canvas 使用）
function getPaperBg() {
  const paper = getActivePaper()
  const bg = paper?.background
  if (!bg) return { backgroundColor: paper?.backgroundColor || '#E8E2D5' }
  if (bg.includes('gradient')) {
    return { backgroundImage: bg, backgroundColor: paper.backgroundColor || '#E8E2D5', backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  if (bg.startsWith('data:') || bg.startsWith('http')) {
    return { backgroundImage: `url(${bg})`, backgroundColor: paper.backgroundColor || '#E8E2D5', backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  return { backgroundColor: bg }
}
// 是否有非纯色稿纸（需要 html2canvas 截 background-image）
function hasPaperImage() {
  const paper = getActivePaper()
  return !!(paper?.background && (paper.background.includes('gradient') || paper.background.startsWith('data:') || paper.background.startsWith('http')))
}

/* ---------- 辅助 ---------- */

const INCH = 25.4       // 1 inch = 25.4 mm
const PT_TO_MM = 0.3528 // 1 pt = 0.3528 mm
const IN_TO_PT = 72     // 1 inch = 72 pt

function toMM(value, unit) {
  if (unit === 'cm') return value * 10
  if (unit === 'in') return value * INCH
  return value // 默认 mm
}
function toPT(value, unit) {
  if (unit === 'in') return value * IN_TO_PT
  if (unit === 'cm') return value * 10 / PT_TO_MM
  return value
}
// twip: 1 inch = 1440 twips, 1 cm = 567 twips, 1 pt = 20 twips
function toTwip(value, unit) {
  if (unit === 'in') return Math.round(value * 1440)
  if (unit === 'cm') return Math.round(value * 567)
  if (unit === 'pt') return Math.round(value * 20)
  return Math.round(value * 567)
}

/* ---------- Fountain ---------- */
export async function exportFountain(elements) {
  const text = serializeScript(elements, 'fountain').trim() + '\n'
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  return saveBlob(blob, 'script.fountain', [{ name: 'Fountain 剧本', extensions: ['fountain', 'txt'] }])
}

/* ---------- Final Draft (.fdx) ---------- */
export async function exportFDX(elements, formatId) {
  const preset = getPresetById(typeof formatId === 'string' ? formatId : formatId?.id)
  const source = (Array.isArray(elements) ? elements : []).filter(el => el.text)
  if (!source.length) throw new Error('没有可导出的正文')

  const esc = (s) => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  const typeMap = {
    slugline: 'Scene Heading',
    action: 'Action',
    character: 'Character',
    parenthetical: 'Parenthetical',
    dialogue: 'Dialogue',
    dualdialogue: 'Dialogue',
    transition: 'Transition',
    note: 'Action',
    shot: 'Shot',
    subheading: 'General',
    teaser: 'General',
    act: 'General',
    endact: 'General',
    title: 'General',
  }

  const body = source.flatMap(el => {
    if (el.type === 'dualdialogue' && el.dual) {
      return [el.dual.left, el.dual.right].map(part =>
        `    <Paragraph Type="Dialogue"><Text>${esc(part.name)}：${esc(part.lines.map(l => l.text).join(' '))}</Text></Paragraph>`
      )
    }
    const type = typeMap[el.type] || 'Action'
    return [`    <Paragraph Type="${type}"><Text>${esc(el.text)}</Text></Paragraph>`]
  }).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<FinalDraft DocumentType="Script" Template="No" Version="5">
  <Content>
${body}
  </Content>
</FinalDraft>
`
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
  return saveBlob(blob, `${(preset.id || 'script')}.fdx`, [{ name: 'Final Draft', extensions: ['fdx'] }])
}

/* ---------- Final Draft (.fdx) 导入 ---------- */
export function importFDX(xmlText) {
  const doc = new DOMParser().parseFromString(String(xmlText || ''), 'text/xml')
  if (doc.querySelector('parsererror')) throw new Error('无法解析这个 .fdx 文件')

  const typeMap = {
    'Scene Heading': 'slugline',
    Action: 'action',
    Character: 'character',
    Parenthetical: 'parenthetical',
    Dialogue: 'dialogue',
    Transition: 'transition',
    Shot: 'shot',
    General: 'action',
    'Act Break': 'act',
    'End of Act': 'endact',
    'Scene Number': 'slugline',
  }

  const paragraphs = Array.from(doc.getElementsByTagName('Paragraph'))
  const elements = []
  paragraphs.forEach(para => {
    const type = typeMap[para.getAttribute('Type')] || 'action'
    const texts = Array.from(para.getElementsByTagName('Text'))
    const text = texts.map(node => node.textContent || '').join('').replace(/\s+$/g, '')
    if (!text.trim()) return
    elements.push({ type, text: text.trim() })
  })
  return elements
}

export async function exportPDF(elements, formatId, meta = {}) {
  const preset = getPresetById(typeof formatId === 'string' ? formatId : formatId?.id)
  formatId = preset.id
  const { page, font, margins, lineHeight, slugline, action, character, parenthetical, dialogue, transition } = preset
  const isCn = preset.family === 'chinese'
  const source = (Array.isArray(elements) ? elements : []).filter(el => el.text || el.type === 'pagebreak')
  if (!source.some(el => el.text)) throw new Error('没有可导出的正文')

  const pageUnit = page?.unit || (isCn ? 'cm' : 'in')
  const pageWPt = toPT(page?.width || (isCn ? 21 : 8.5), pageUnit)
  const pageHPt = toPT(page?.height || (isCn ? 29.7 : 11), pageUnit)
  const marginUnit = margins.unit || pageUnit
  const mlPt = toPT(margins.left, marginUnit)
  const mrPt = toPT(margins.right, marginUnit)
  const mtPt = toPT(margins.top, marginUnit)
  const mbPt = toPT(margins.bottom, marginUnit)
  const fontSizePt = font?.sizePt || 12
  const px = value => value * 96 / 72

  const host = document.createElement('div')
  Object.assign(host.style, {
    position: 'fixed', left: '-10000px', top: '0', width: `${px(pageWPt)}px`,
    pointerEvents: 'none', zIndex: '-1', background: 'transparent',
  })
  document.body.appendChild(host)

  const createPage = () => {
    const node = document.createElement('div')
    const paperBg = getPaperBg()
    Object.assign(node.style, {
      boxSizing: 'border-box',
      width: `${pageWPt}pt`, height: `${pageHPt}pt`,
      padding: `${mtPt}pt ${mrPt}pt ${mbPt}pt ${mlPt}pt`,
      overflow: 'hidden', color: isCn ? '#1C1C24' : '#2A2420',
      fontFamily: font?.family || (isCn ? 'FangSong, serif' : 'Courier New, monospace'),
      fontSize: `${fontSizePt}pt`, lineHeight: String(lineHeight || 1.15),
      // 稿纸背景（纯色或图/渐变）
      backgroundColor: paperBg.backgroundColor || (isCn ? '#FFFFFF' : '#E8E2D5'),
      ...(paperBg.backgroundImage ? { backgroundImage: paperBg.backgroundImage, backgroundSize: paperBg.backgroundSize, backgroundPosition: paperBg.backgroundPosition } : {}),
    })
    host.appendChild(node)
    return node
  }

  const after = value => `${fontSizePt * (value ?? 1)}pt`

  const createDual = el => {
    const wrap = document.createElement('div')
    Object.assign(wrap.style, {
      display: 'flex', alignItems: 'flex-start', gap: '1.2em',
      marginBottom: after(dialogue?.spaceAfter), font: 'inherit', lineHeight: 'inherit',
    })
    const columns = [el.dual.left, el.dual.right]
    columns.forEach((part, index) => {
      const col = document.createElement('div')
      col.style.flex = '1'
      col.style.minWidth = '0'
      if (!isCn) col.style.marginLeft = index === 0
        ? `${Math.max(0, toPT(character?.indentIn || 3.7, 'in') - mlPt)}pt`
        : '0'

      const cue = document.createElement('p')
      cue.textContent = part.name
      Object.assign(cue.style, {
        margin: '0', textAlign: 'center', whiteSpace: 'pre-wrap',
        fontWeight: isCn || character?.bold ? '700' : '400',
        textTransform: character?.uppercase === false || isCn ? 'none' : 'uppercase',
        lineHeight: 'inherit',
      })
      col.appendChild(cue)

      part.lines.forEach(line => {
        const p = document.createElement('p')
        p.textContent = line.text
        Object.assign(p.style, {
          margin: '0', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', lineHeight: 'inherit',
          textAlign: line.type === 'parenthetical' || isCn ? 'center' : 'left',
          fontStyle: line.type === 'parenthetical' ? 'italic' : 'normal',
        })
        col.appendChild(p)
      })
      wrap.appendChild(col)
    })
    return wrap
  }

  const createElement = el => {
    if (el.type === 'dualdialogue' && el.dual) return createDual(el)
    const node = document.createElement('p')
    node.textContent = el.text
    Object.assign(node.style, {
      margin: '0', padding: '0', whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
      font: 'inherit', lineHeight: 'inherit',
    })

    switch (el.type) {
      case 'slugline':
        node.style.fontWeight = slugline?.bold === false ? '400' : '700'
        node.style.textTransform = slugline?.uppercase ? 'uppercase' : 'none'
        node.style.marginBottom = after(slugline?.spaceAfter)
        break
      case 'action':
        node.style.marginBottom = after(action?.spaceAfter)
        if (isCn) node.style.textIndent = '2em'
        break
      case 'character':
        node.style.fontWeight = isCn || character?.bold ? '700' : '400'
        node.style.textTransform = character?.uppercase ? 'uppercase' : 'none'
        node.style.marginBottom = after(character?.spaceAfter || 0)
        if (isCn) node.style.textAlign = 'center'
        else node.style.marginLeft = `${Math.max(0, toPT(character?.indentIn || 3.7, 'in') - mlPt)}pt`
        break
      case 'parenthetical':
        node.style.marginBottom = after(parenthetical?.spaceAfter || 0)
        if (isCn) node.style.textAlign = 'center'
        else {
          node.style.marginLeft = `${Math.max(0, toPT(parenthetical?.leftIn || 3.1, 'in') - mlPt)}pt`
          node.style.marginRight = `${Math.max(0, toPT(parenthetical?.rightIn || 2.9, 'in') - mrPt)}pt`
        }
        break
      case 'dialogue':
        node.style.marginBottom = after(dialogue?.spaceAfter)
        if (isCn) node.style.textIndent = '2em'
        else {
          node.style.marginLeft = `${Math.max(0, toPT(dialogue?.leftIn || 3.1, 'in') - mlPt)}pt`
          node.style.marginRight = `${Math.max(0, toPT(dialogue?.rightIn || 2.9, 'in') - mrPt)}pt`
        }
        break
      case 'transition':
        node.style.textAlign = 'right'
        node.style.fontWeight = transition?.bold ? '700' : '400'
        node.style.textTransform = transition?.uppercase ? 'uppercase' : 'none'
        node.style.marginBottom = after(transition?.spaceAfter)
        break
      case 'teaser':
      case 'act':
      case 'endact':
        node.style.textAlign = 'center'
        node.style.fontWeight = '700'
        node.style.textTransform = isCn ? 'none' : 'uppercase'
        node.style.letterSpacing = '0.12em'
        node.style.marginTop = after(1)
        node.style.marginBottom = after(1.6)
        break
      case 'shot':
        node.style.fontWeight = '700'
        if (!isCn) node.style.textTransform = 'uppercase'
        node.style.marginBottom = after(action?.spaceAfter)
        break
      case 'subheading':
        node.style.textAlign = 'center'
        node.style.fontWeight = '700'
        node.style.textDecoration = 'underline'
        node.style.marginBottom = after(action?.spaceAfter)
        break
      case 'note':
        node.style.fontStyle = 'italic'
        node.style.opacity = '0.65'
        node.style.marginBottom = after(1)
        break
      default:
        node.style.marginBottom = after(1)
    }
    return node
  }

  // 标题页：片名居中 + Written by / 编剧；封面不计页码
  const createTitlePage = () => {
    const node = createPage()
    Object.assign(node.style, {
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center', textAlign: 'center',
    })
    const title = document.createElement('div')
    title.textContent = String(meta.title || '').trim()
    Object.assign(title.style, {
      fontWeight: '700',
      fontSize: `${fontSizePt * 1.7}pt`,
      lineHeight: '1.35',
      letterSpacing: isCn ? '0.12em' : '0.02em',
      textTransform: isCn ? 'none' : 'uppercase',
      marginBottom: `${fontSizePt * 2.4}pt`,
      maxWidth: '82%',
    })
    node.appendChild(title)

    const by = document.createElement('div')
    by.textContent = isCn ? '编剧' : 'Written by'
    Object.assign(by.style, { fontSize: `${fontSizePt}pt`, opacity: '0.8', marginBottom: `${fontSizePt * 0.6}pt` })
    node.appendChild(by)

    const author = String(meta.author || '').trim()
    if (author) {
      const au = document.createElement('div')
      au.textContent = author
      Object.assign(au.style, { fontSize: `${fontSizePt * 1.1}pt` })
      node.appendChild(au)
    }
    return node
  }

  try {
    // 把「必须同页」的元素合成原子块，避免场景头/角色名/括号被拆到两页
    const groups = []
    for (let i = 0; i < source.length; i++) {
      const el = source[i]
      if (el.type === 'pagebreak') {
        groups.push({ break: true })
        continue
      }
      const group = [el]
      if (el.type === 'slugline') {
        let j = i + 1
        while (j < source.length && group.length <= 2 && ['action', 'note', 'shot', 'subheading'].includes(source[j].type)) {
          group.push(source[j]); j++
        }
        i = j - 1
      } else if (el.type === 'character') {
        let j = i + 1
        while (j < source.length && (source[j].type === 'parenthetical' || source[j].type === 'dialogue')) {
          group.push(source[j]); j++
        }
        i = j - 1
      } else if (el.type === 'parenthetical') {
        let j = i + 1
        while (j < source.length && source[j].type === 'dialogue') {
          group.push(source[j]); j++
        }
        i = j - 1
      }
      groups.push({ elements: group })
    }

    const pages = []
    let current = createPage()
    groups.forEach(group => {
      if (group.break) {
        if (current.childElementCount) {
          pages.push(current)
          current = createPage()
        }
        return
      }
      const nodes = group.elements.map(createElement)
      nodes.forEach(node => current.appendChild(node))
      if (current.scrollHeight > current.clientHeight + 1 && current.childElementCount > nodes.length) {
        nodes.forEach(node => current.removeChild(node))
        pages.push(current)
        current = createPage()
        nodes.forEach(node => current.appendChild(node))
      }
    })
    if (current.childElementCount) pages.push(current)
    if (!pages.length) throw new Error('没有可导出的正文')

    if (document.fonts?.ready) await document.fonts.ready
    const doc = new jsPDF({ unit: 'pt', format: [pageWPt, pageHPt], orientation: 'portrait', compress: true })

    const hasTitlePage = Boolean(preset.titlePage && String(meta.title || '').trim())
    if (hasTitlePage) {
      const cover = createTitlePage()
      const canvas = await html2canvas(cover, {
        scale: 2, logging: false, useCORS: true,
        ...(hasPaperImage() ? {} : { backgroundColor: getPaperBg().backgroundColor || (isCn ? '#FFFFFF' : '#E8E2D5') }),
        width: Math.ceil(px(pageWPt)), height: Math.ceil(px(pageHPt)),
        windowWidth: Math.ceil(px(pageWPt)),
      })
      doc.addImage(canvas.toDataURL('image/jpeg', 0.96), 'JPEG', 0, 0, pageWPt, pageHPt)
      host.removeChild(cover)
    }

    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], {
        scale: 2, logging: false, useCORS: true,
        ...(hasPaperImage() ? {} : { backgroundColor: getPaperBg().backgroundColor || (isCn ? '#FFFFFF' : '#E8E2D5') }),
        width: Math.ceil(px(pageWPt)), height: Math.ceil(px(pageHPt)),
        windowWidth: Math.ceil(px(pageWPt)),
      })
      if (hasTitlePage || i > 0) doc.addPage([pageWPt, pageHPt], 'portrait')
      doc.addImage(canvas.toDataURL('image/jpeg', 0.96), 'JPEG', 0, 0, pageWPt, pageHPt)
      // 页码：右上角，首页不编（行业惯例）；有了封面页后正文首页仍不编
      if (i > 0) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(90, 90, 90)
        doc.text(`${i + 1}.`, pageWPt - mrPt, Math.max(18, mtPt * 0.5))
      }
    }
    const pdfBlob = doc.output('blob')
    return saveBlob(pdfBlob, 'script.pdf', [{ name: 'PDF 文档', extensions: ['pdf'] }])
  } finally {
    host.remove()
  }
}

/* ---------- DOCX ---------- */
export async function exportDOCX(elements, formatId) {
  const preset = getPresetById(typeof formatId === 'string' ? formatId : formatId?.id)
  formatId = preset.id
  const { page, font, margins, lineHeight, slugline, action, character, parenthetical, dialogue, transition } = preset
  const isCn = preset.family === 'chinese'

  const children = []

  // 把 preset 缩进换成 twip（docx 内部单位）
  const mlTwip = toTwip(margins.left, margins.unit || (page?.unit || 'in'))
  const mrTwip = toTwip(margins.right, margins.unit || (page?.unit || 'in'))
  const mtTwip = toTwip(margins.top, margins.unit || (page?.unit || 'in'))
  const mbTwip = toTwip(margins.bottom, margins.unit || (page?.unit || 'in'))

  // 字体：docx 用 half-points（所以 pt × 2）
  const fontSizeHalfPt = (font?.sizePt || 12) * 2
  const fontFamily = isCn ? 'FangSong' : 'Courier New'
  // 行距：cn-gov 用固定 30pt = 600 twip，其它用 auto（多倍）
  const lineSpacing = isCn
    ? { line: 600, lineRule: 'exact' }
    : { line: Math.round(lineHeight * 240), lineRule: 'auto' }  // 240 = 单倍行距基准

  // Word 的缩进是相对【正文框】的，而行业规范按纸张边缘计量 → 需要先减去页边距再换算
  // 角色名 3.7" 距纸左 → 3.7 - 1.5 = 2.2"；对白 3.1"~5.6" → 左 1.6"、右 (7.5-5.6)=1.9"
  const leftMarginIn = margins.left
  const rightEdgeIn = (page?.width || 8.5) - margins.right   // 正文框右边界（距纸左）
  const charIndentTwip = isCn ? 0
    : toTwip((character?.indentIn || 3.7) - leftMarginIn, 'in')
  const parenLeftTwip = toTwip((parenthetical?.leftIn || 3.1) - leftMarginIn, 'in')
  const parenRightTwip = toTwip(rightEdgeIn - (page?.width || 8.5) + (parenthetical?.rightIn || 2.9), 'in')
  const dialLeftTwip = toTwip((dialogue?.leftIn || 3.1) - leftMarginIn, 'in')
  const dialRightTwip = toTwip(rightEdgeIn - (page?.width || 8.5) + (dialogue?.rightIn || 2.9), 'in')

  elements.forEach(el => {
    if (!el.text && el.type !== 'pagebreak') return

    if (el.type === 'pagebreak') {
      children.push(new Paragraph({
        pageBreakBefore: true,
        children: [new TextRun({ text: '', size: fontSizeHalfPt, font: fontFamily })],
      }))
      return
    }

    // 双人对话：两列按顺序导出（左角色 → 右角色）
    if (el.type === 'dualdialogue' && el.dual) {
      ;[el.dual.left, el.dual.right].forEach(part => {
        children.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { ...lineSpacing, after: Math.round(fontSizeHalfPt * 0.5) },
          children: [new TextRun({
            text: part.name, size: fontSizeHalfPt, font: fontFamily,
            bold: isCn || character?.bold,
          })],
        }))
        part.lines.forEach(line => {
          children.push(new Paragraph({
            spacing: { ...lineSpacing, after: Math.round(fontSizeHalfPt * 0.5) },
            indent: isCn ? { firstLine: fontSizeHalfPt * 4 } : { left: dialLeftTwip, right: dialRightTwip },
            children: [new TextRun({
              text: line.text, size: fontSizeHalfPt, font: fontFamily,
              italics: line.type === 'parenthetical',
            })],
          }))
        })
      })
      return
    }

    let text = el.text
    let opts = { spacing: { ...lineSpacing, after: Math.round(fontSizeHalfPt * 0.5) } }
    let alignment

    switch (el.type) {
      case 'slugline':
        if (slugline?.uppercase) text = text.toUpperCase()
        opts = {
          ...opts,
          indent: { firstLine: isCn ? 0 : 0 },
        }
        break
      case 'action':
        if (isCn) opts.indent = { firstLine: fontSizeHalfPt * 4 } // 首空两格 ≈ 两个汉字
        break
      case 'character':
        if (character?.uppercase) text = text.toUpperCase()
        opts = {
          ...opts,
          alignment: isCn ? AlignmentType.CENTER : undefined,
          indent: isCn ? { firstLine: 0 } : { left: charIndentTwip },
        }
        break
      case 'parenthetical':
        opts = {
          ...opts,
          alignment: isCn ? AlignmentType.CENTER : undefined,
          indent: isCn ? { firstLine: 0 } : { left: parenLeftTwip, right: parenRightTwip },
        }
        break
      case 'dialogue':
        if (isCn) {
          opts.indent = { firstLine: fontSizeHalfPt * 4 }
        } else {
          opts.indent = { left: dialLeftTwip, right: dialRightTwip }
        }
        break
      case 'transition':
        if (transition?.uppercase) text = text.toUpperCase()
        opts = { ...opts, alignment: AlignmentType.RIGHT }
        break
      case 'teaser':
      case 'act':
      case 'endact':
        if (!isCn) text = text.toUpperCase()
        opts = {
          ...opts,
          alignment: AlignmentType.CENTER,
          spacing: { ...lineSpacing, before: Math.round(fontSizeHalfPt * 2), after: Math.round(fontSizeHalfPt * 2) },
        }
        break
      case 'shot':
        if (!isCn) text = text.toUpperCase()
        break
      case 'subheading':
        opts = { ...opts, alignment: AlignmentType.CENTER }
        break
      default: break
    }

    const run = new TextRun({
      text,
      size: fontSizeHalfPt,
      font: fontFamily,
      bold: (
        (el.type === 'slugline' && slugline?.bold !== false) ||
        (el.type === 'character' && character?.bold) ||
        (el.type === 'transition' && transition?.bold) ||
        (isCn && (el.type === 'slugline' || el.type === 'character'))
      ),
    })

    children.push(new Paragraph({ children: [run], ...opts }))
  })

  const pageWTwip = toTwip(page?.width || (isCn ? 21 : 8.5), page?.unit || (isCn ? 'cm' : 'in'))
  const pageHTwip = toTwip(page?.height || (isCn ? 29.7 : 11), page?.unit || (isCn ? 'cm' : 'in'))

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          width: pageWTwip,
          height: pageHTwip,
          margin: { top: mtTwip, bottom: mbTwip, left: mlTwip, right: mrTwip },
        },
      },
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  return saveBlob(blob, 'script.docx', [{ name: 'Word 文档', extensions: ['docx'] }])
}

/* ---------- HTML ---------- */
export async function exportHTML(elements, formatId) {
  const preset = getPresetById(typeof formatId === 'string' ? formatId : formatId?.id)
  formatId = preset.id
  const { page, font, margins, slugline, action, character, parenthetical, dialogue, transition } = preset
  const isCn = preset.family === 'chinese'

  // 构建嵌入式 CSS — 和 index.css 里 .script-page.format-xxx 保持一致
  const css = buildInlineCSS(formatId, preset)

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>幕后 · 文字剧场 — ${preset.name}</title>
  <style>${css}</style>
</head>
<body>
  <div class="script-page format-${formatId}">
    ${elements.map(el => {
      if (el.type === 'pagebreak') return '<div class="page-break"></div>'
      if (!el.text && !el.dual) return ''
      const cn = isCn

      if (el.type === 'dualdialogue' && el.dual) {
        const column = part => `<div class="dual-col">
          <p class="dual-name">${escapeHtml(part.name)}</p>
          ${part.lines.map(line => `<p class="${line.type === 'parenthetical' ? 'dual-parenthetical' : 'dual-line'}">${escapeHtml(line.text)}</p>`).join('')}
        </div>`
        return `<div class="dualdialogue">${column(el.dual.left)}${column(el.dual.right)}</div>`
      }

      let text = el.text

      if (slugline?.uppercase && el.type === 'slugline') text = text.toUpperCase()
      if (character?.uppercase !== false && el.type === 'character') text = text.toUpperCase()
      if (transition?.uppercase && el.type === 'transition') text = text.toUpperCase()
      if (!cn && ['teaser', 'act', 'endact', 'shot'].includes(el.type)) text = text.toUpperCase()

      // cn-gov action / dialogue 段首空两格（纯文本）
      if (cn && (el.type === 'action' || el.type === 'dialogue')) {
        text = '　　' + text
      }

      return `<p class="${el.type}">${escapeHtml(text)}</p>`
    }).join('\n')}
  </div>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  return saveBlob(blob, 'script.html', [{ name: 'HTML 网页', extensions: ['html'] }])
}

// 根据 formatId + preset 生成自包含的 HTML 样式（内嵌一份，脱离主站也能正常显示）
function buildInlineCSS(formatId, preset) {
  const { page, font, margins, lineHeight } = preset
  const isCn = preset.family === 'chinese'
  const pageW = page?.width || (isCn ? 21 : 8.5)
  const pageH = page?.height || (isCn ? 29.7 : 11)
  const pageUnit = page?.unit || (isCn ? 'cm' : 'in')

  // 把 margin unit 统一成 page unit
  const unit = margins?.unit || pageUnit
  const mUnit = unit
  const ml = margins.left, mr = margins.right, mt = margins.top, mb = margins.bottom

  let fontFace = 'Courier Prime, Courier, monospace'
  let fontSize = `${font?.sizePt || 12}pt`
  let bg = '#E8E2D5'
  let fg = '#2A2420'
  let lineH = lineHeight || 1.15
  let pagePadding = `${mt}${mUnit} ${mr}${mUnit} ${mb}${mUnit} ${ml}${mUnit}`

  if (isCn) {
    fontFace = "'FangSong', 'STFangsong', 'Noto Serif SC', serif"
    bg = '#FFFFFF'
    fg = '#1C1C24'
    lineH = 30 / 16 // 30磅行距 / 16pt字号
  }

  // 稿纸覆盖
  const paperBg = getPaperBg()
  const hasPaperImg = hasPaperImage()
  if (paperBg.backgroundColor) bg = paperBg.backgroundColor

  const slugBold = formatId !== 'bbc' && (preset.slugline?.bold !== false)
  const charBold = isCn || (preset.character?.bold ?? (formatId === 'hollywood' || formatId === 'netflix'))
  const transBold = formatId !== 'bbc' && (preset.transition?.bold !== false)

  const cnExtra = isCn ? `
    .script-page .character { text-align: center; font-weight: bold; }
    .script-page .parenthetical { text-align: center; }
    .script-page .transition { text-align: right; font-weight: bold; }
    .script-page .slugline { font-weight: bold; }
  ` : `
    .script-page .slugline { text-transform: uppercase; font-weight: ${slugBold ? 'bold' : 'normal'}; margin-bottom: 12pt; }
    .script-page .action { margin-bottom: 12pt; }
    /* 缩进按纸张边缘换算到正文框：角色名 3.7-1.5=2.2in；对白左 3.1-1.5=1.6in、右 7.5-5.6=1.9in */
    .script-page .character { text-transform: uppercase; margin-left: ${((preset.character?.indentIn || 3.7) - margins.left).toFixed(2)}in; font-weight: ${charBold ? 'bold' : 'normal'}; }
    .script-page .parenthetical { margin-left: ${((preset.parenthetical?.leftIn || 3.1) - margins.left).toFixed(2)}in; margin-right: ${(pageW - margins.right - (pageW - (preset.parenthetical?.rightIn || 2.9))).toFixed(2)}in; }
    .script-page .dialogue { margin-left: ${((preset.dialogue?.leftIn || 3.1) - margins.left).toFixed(2)}in; margin-right: ${(pageW - margins.right - (pageW - (preset.dialogue?.rightIn || 2.9))).toFixed(2)}in; margin-bottom: 12pt; }
    .script-page .transition { text-align: right; font-weight: ${transBold ? 'bold' : 'normal'}; margin-bottom: 12pt; }
  `

  return `
    @page { size: ${pageW}${pageUnit} ${pageH}${pageUnit}; margin: 0; }
    body { margin: 0; background: #0C0C0F; padding: 40px 20px; }
    .script-page {
      box-sizing: border-box;
      background-color: ${bg}; color: ${fg};
      ${hasPaperImg && paperBg.backgroundImage ? `background-image: ${paperBg.backgroundImage}; background-size: cover; background-position: center;` : ''}
      padding: ${pagePadding};
      margin: 0 auto;
      width: ${pageW}${pageUnit};
      min-height: ${pageH}${pageUnit};
      box-shadow: 0 0 60px rgba(0,0,0,.5);
      font-family: ${fontFace};
      font-size: ${fontSize};
      line-height: ${lineH};
    }
    .script-page .page-break { page-break-before: always; height: 0; border: 0; }
    .script-page .teaser, .script-page .act, .script-page .endact {
      text-align: center; font-weight: bold; letter-spacing: .12em; text-transform: uppercase;
      margin: 18pt 0 14pt;
    }
    .script-page .shot { font-weight: bold; text-transform: uppercase; }
    .script-page .subheading { text-align: center; font-weight: bold; text-decoration: underline; }
    .script-page .dualdialogue { display: flex; gap: 1.2em; margin-bottom: 12pt; }
    .script-page .dualdialogue .dual-col { flex: 1; min-width: 0; }
    .script-page .dualdialogue .dual-name { text-align: center; font-weight: bold; text-transform: uppercase; margin-bottom: 0; }
    .script-page .dualdialogue .dual-parenthetical { text-align: center; font-style: italic; margin-bottom: 0; }
    .script-page .dualdialogue .dual-line { margin-bottom: 0; }
    ${cnExtra}
    p { margin: 0 0 12pt 0; }
  `
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

/* ---------- Storyboard CSV / HTML ---------- */
export async function exportStoryboardCSV(rows) {
  const headers = ['场号', '镜号', '景别', '运镜', '时长(秒)', '画面描述', '动作', '台词/旁白', '音效', '备注']
  const csvRows = rows.map(r => [
    r.scene, r.cut, r.shotSize, r.cameraMove, r.duration,
    r.image, r.action, r.dialogue, r.sfx, r.notes
  ])
  const csv = [headers, ...csvRows]
    .map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  return saveBlob(blob, 'storyboard.csv', [{ name: 'CSV 表格', extensions: ['csv'] }])
}

export async function exportStoryboardHTML(rows) {
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>分镜表 Storyboard</title>
<style>
body { font-family: sans-serif; padding: 20px; background: #fafafa; }
table { border-collapse: collapse; width: 100%; font-size: 12px; background: #fff; }
th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
th { background: #2A2420; color: #E8E2D5; }
h1 { text-align: center; margin-bottom: 20px; font-weight: 400; }
</style></head>
<body>
<h1>分镜表 · Storyboard</h1>
<table>
<thead><tr><th>场号</th><th>镜号</th><th>景别</th><th>运镜</th><th>时长</th><th>画面</th><th>动作</th><th>台词</th><th>音效</th><th>备注</th></tr></thead>
<tbody>
${rows.map(r => `<tr><td>${r.scene || ''}</td><td>${r.cut || ''}</td><td>${r.shotSize || ''}</td><td>${r.cameraMove || ''}</td><td>${r.duration || ''}</td><td>${r.image || ''}</td><td>${r.action || ''}</td><td>${r.dialogue || ''}</td><td>${r.sfx || ''}</td><td>${r.notes || ''}</td></tr>`).join('\n')}
</tbody></table>
</body></html>`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  return saveBlob(blob, 'storyboard.html', [{ name: 'HTML 网页', extensions: ['html'] }])
}
