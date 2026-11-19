// DOCX 样式感知解析：直接读取 OOXML，而不是把 DOCX 压成纯文本。
//
// 输出统一的段落对象，交给 scriptImportClassifier 判断剧本元素类型：
//   { text, styleId, styleName, bold, italic, align, indentIn, pageBreak }
// 这样角色名、对白、场景头等 Word 样式信息不会在导入时丢失。

import JSZip from 'jszip'

const TWIPS_PER_INCH = 1440

/** 按 localName 取后代节点，兼容不同的命名空间前缀 */
function tags(root, local) {
  if (!root) return []
  return Array.from(root.getElementsByTagNameNS('*', local))
}

function attr(el, name) {
  if (!el) return ''
  return el.getAttribute(`w:${name}`) ?? el.getAttribute(name) ?? ''
}

/** 解析 word/styles.xml，得到 styleId → { name, basedOn } */
function parseStyles(xml) {
  const map = {}
  if (!xml) return map
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  tags(doc, 'style').forEach(style => {
    if (attr(style, 'type') && attr(style, 'type') !== 'paragraph') return
    const id = attr(style, 'styleId')
    if (!id) return
    const nameNode = tags(style, 'name')[0]
    const basedNode = tags(style, 'basedOn')[0]
    map[id] = {
      name: nameNode ? attr(nameNode, 'val') : '',
      basedOn: basedNode ? attr(basedNode, 'val') : '',
    }
  })
  return map
}

/** 沿 basedOn 链找到第一个有可读名称的样式名 */
function resolveStyleName(id, styles) {
  let current = id
  for (let i = 0; i < 6 && current; i++) {
    const item = styles[current]
    if (!item) break
    if (item.name) return item.name
    current = item.basedOn
  }
  return id || ''
}

function isOn(el) {
  if (!el) return false
  const val = attr(el, 'val')
  return val !== '0' && val !== 'false' && val !== 'off'
}

/** 读取一个 w:p，抽取文本、样式与版式线索 */
function readParagraph(node, styles) {
  const pPr = tags(node, 'pPr')[0]
  const styleNode = pPr ? tags(pPr, 'pStyle')[0] : null
  const styleId = styleNode ? attr(styleNode, 'val') : ''
  const styleName = resolveStyleName(styleId, styles)

  const jcNode = pPr ? tags(pPr, 'jc')[0] : null
  const align = jcNode ? attr(jcNode, 'val') : ''
  const indNode = pPr ? tags(pPr, 'ind')[0] : null
  const indentTwips = Number(attr(indNode, 'left') || attr(indNode, 'start') || 0) || 0
  const indentIn = indentTwips ? indentTwips / TWIPS_PER_INCH : 0
  const pageBreakBefore = pPr ? tags(pPr, 'pageBreakBefore').length > 0 : false

  let text = ''
  let boldChars = 0
  let italicChars = 0
  let totalChars = 0
  let hasPageBreak = false

  tags(node, 'r').forEach(run => {
    const rPr = tags(run, 'rPr')[0]
    const isBold = rPr ? isOn(tags(rPr, 'b')[0]) : false
    const isItalic = rPr ? isOn(tags(rPr, 'i')[0]) : false

    Array.from(run.childNodes || []).forEach(child => {
      const local = child.localName
      if (local === 't') {
        const value = child.textContent || ''
        text += value
        const len = value.replace(/\s/g, '').length
        totalChars += len
        if (isBold) boldChars += len
        if (isItalic) italicChars += len
      } else if (local === 'tab') {
        text += '\t'
      } else if (local === 'br' || local === 'cr') {
        if (attr(child, 'type') === 'page') hasPageBreak = true
        text += '\n'
      }
    })
  })

  return {
    text: text.replace(/\u00a0/g, ' ').trim(),
    styleId,
    styleName,
    bold: totalChars ? boldChars / totalChars : false,
    italic: totalChars ? italicChars / totalChars : false,
    align,
    indentIn,
    pageBreak: pageBreakBefore || hasPageBreak,
  }
}

/**
 * 读取 DOCX 的所有段落（含表格里的段落），保持文档顺序。
 * 抛错时调用方可回退到 mammoth 纯文本解析。
 */
export async function extractDocxParagraphs(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer)
  const docFile = zip.file('word/document.xml')
  if (!docFile) throw new Error('DOCX 里缺少 word/document.xml')

  const [docXml, stylesXml] = await Promise.all([
    docFile.async('string'),
    zip.file('word/styles.xml')?.async('string') || Promise.resolve(''),
  ])

  const styles = parseStyles(stylesXml)
  const doc = new DOMParser().parseFromString(docXml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('DOCX 的 document.xml 解析失败')
  }

  return tags(doc, 'p')
    .map(node => readParagraph(node, styles))
    .filter(p => p.text || p.pageBreak)
}
