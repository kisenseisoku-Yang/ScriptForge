// ============ 稿纸库（Paper Textures）============
// 内置稿纸用 data URI（SVG 内嵌纹理 + CSS 渐变），零额外打包体积、离线可用、不被墙。
// 用户自定义稿纸由上传 canvas 压缩后 base64 存 localStorage。

// SVG 内嵌的横纹稿纸纹理（标准剧本稿纸：米白底 + 蓝横线 + 红边距线）
const LINED_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#F4ECD8"/>
  <rect x="32" y="0" width="1.2" height="400" fill="#E07B7B" opacity="0.55"/>
  <g stroke="#7BA3C7" stroke-width="0.8" opacity="0.55">
    <line x1="0" y1="40" x2="400" y2="40"/>
    <line x1="0" y1="80" x2="400" y2="80"/>
    <line x1="0" y1="120" x2="400" y2="120"/>
    <line x1="0" y1="160" x2="400" y2="160"/>
    <line x1="0" y1="200" x2="400" y2="200"/>
    <line x1="0" y1="240" x2="400" y2="240"/>
    <line x1="0" y1="280" x2="400" y2="280"/>
    <line x1="0" y1="320" x2="400" y2="320"/>
    <line x1="0" y1="360" x2="400" y2="360"/>
  </g>
  <rect width="400" height="400" fill="url(#grain)" opacity="0.08"/>
  <filter id="grain"><feTurbulence baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.6  0 0 0 0 0.55  0 0 0 0 0.45  0 0 0 0.15 0"/></filter>
</svg>`)}`

// SVG 方格纸
const GRID_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#FBF8F0"/>
  <g stroke="#BFB7A0" stroke-width="0.5" opacity="0.45">
    ${Array.from({length: 20}, (_, i) => `<line x1="${i*20}" y1="0" x2="${i*20}" y2="400"/>`).join('')}
    ${Array.from({length: 20}, (_, i) => `<line x1="0" y1="${i*20}" x2="400" y2="${i*20}"/>`).join('')}
  </g>
  <g stroke="#8A8070" stroke-width="0.8" opacity="0.35">
    ${Array.from({length: 5}, (_, i) => `<line x1="${i*80}" y1="0" x2="${i*80}" y2="400"/>`).join('')}
    ${Array.from({length: 5}, (_, i) => `<line x1="0" y1="${i*80}" x2="400" y2="${i*80}"/>`).join('')}
  </g>
</svg>`)}`

// SVG 宣纸纤维纹理（米白 + 细微纤维）
const RICE_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#F6F1E4"/>
  <filter id="fiber"><feTurbulence baseFrequency="0.02 0.8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.72  0 0 0 0 0.66  0 0 0 0 0.52  0 0 0 0.22 0"/></filter>
  <rect width="400" height="400" filter="url(#fiber)" opacity="0.6"/>
</svg>`)}`

// SVG 纯米白（当前默认稿纸，保留作选项）
const PLAIN_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#E8E2D5"/></svg>`)}`

// CSS 渐变定义（通过 background 属性直接应用）
const PARCHMENT_CSS = `linear-gradient(135deg, #D4C49A 0%, #C7B682 25%, #B8A470 50%, #C9B98B 75%, #D8CA9F 100%), radial-gradient(ellipse at 30% 20%, rgba(0,0,0,0.12), transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(0,0,0,0.18), transparent 55%)`
const VINTAGE_CSS = `linear-gradient(180deg, #E8DCC0 0%, #DCCFAE 50%, #D1C39F 100%), radial-gradient(ellipse at 50% 0%, rgba(120,80,20,0.15), transparent 70%), radial-gradient(ellipse at 50% 100%, rgba(80,40,0,0.18), transparent 70%)`

export const BUILTIN_PAPERS = [
  {
    id: 'builtin-plain',
    name: '纯白稿纸',
    preview: PLAIN_SVG,
    // 纯白稿纸直接用 CSS background-color，不盖图案
    background: null,
    backgroundColor: '#E8E2D5',
  },
  {
    id: 'builtin-lined',
    name: '标准横纹',
    preview: LINED_SVG,
    background: LINED_SVG,
    backgroundColor: '#F4ECD8',
  },
  {
    id: 'builtin-grid',
    name: '方格稿纸',
    preview: GRID_SVG,
    background: GRID_SVG,
    backgroundColor: '#FBF8F0',
  },
  {
    id: 'builtin-parchment',
    name: '羊皮纸',
    preview: PARCHMENT_CSS,
    background: PARCHMENT_CSS,
    backgroundColor: '#B8A470',
  },
  {
    id: 'builtin-vintage',
    name: '泛黄老纸',
    preview: VINTAGE_CSS,
    background: VINTAGE_CSS,
    backgroundColor: '#DCCFAE',
  },
  {
    id: 'builtin-rice',
    name: '宣纸',
    preview: RICE_SVG,
    background: RICE_SVG,
    backgroundColor: '#F6F1E4',
  },
  // === 在线资源（首次使用时自动 fetch 到 localStorage data URL） ===
  {
    id: 'builtin-oldpaper',
    name: '复古老纸',
    preview: VINTAGE_CSS,
    // Wikimedia Commons Public Domain —— 首次访问时 fetch
    remoteUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Old_paper1.jpg?width=2048',
    backgroundColor: '#D4C5A0',
  },
  {
    id: 'builtin-parchment-hd',
    name: '高清羊皮纸',
    preview: PARCHMENT_CSS,
    remoteUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Vintage_Paper_Texture_(9789792113).jpg?width=2048',
    backgroundColor: '#C9B780',
  },
  {
    id: 'builtin-darkpaper',
    name: '暗调旧书',
    preview: 'linear-gradient(180deg, #A08960 0%, #8E7648 60%, #6F5A38 100%)',
    remoteUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Dark_Damaged_Old_Vintage_Book_Paper_Pages_Free_High_Resolution_Wallpaper_Texture_Creative_Commons_(8077075546).jpg?width=2048',
    backgroundColor: '#8E7648',
  },
]

// 稿纸背景 → CSS background 属性值（供 inline style 用）
// 对于只有 remoteUrl 的在线稿纸：返回 preview CSS 作为 fallback，同时后台 fetch 原图存 localStorage
export function paperToBackgroundCss(paper) {
  if (!paper) return null
  // 已经有 background（SVG/CSS/缓存好的 data URL）
  if (paper.background) return paper.background
  // 只有 remoteUrl：查缓存
  if (paper.remoteUrl) {
    const cached = localStorage.getItem('scriptforge_paper_cache_' + paper.id)
    if (cached) return cached
    // 没缓存：返回 preview 作为 fallback，同时后台 fetch
    warmupRemotePaper(paper)
    return paper.preview || paper.backgroundColor
  }
  return null
}

// 后台 fetch 在线稿纸 → canvas 压缩 → localStorage（首次选稿纸时不阻塞 UI）
const _fetching = {}
async function warmupRemotePaper(paper) {
  if (_fetching[paper.id]) return
  _fetching[paper.id] = true
  try {
    const resp = await fetch(paper.remoteUrl)
    if (!resp.ok) throw new Error('HTTP ' + resp.status)
    const blob = await resp.blob()
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = reject
      reader.onload = () => {
        const img = new Image()
        img.onerror = reject
        img.onload = () => {
          const MAX = 2048
          let { width, height } = img
          if (width > height && width > MAX) { height = Math.round(height * MAX / width); width = MAX }
          else if (height > MAX) { width = Math.round(width * MAX / height); height = MAX }
          const canvas = document.createElement('canvas')
          canvas.width = width; canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.88))
        }
        img.src = reader.result
      }
      reader.readAsDataURL(blob)
    })
    localStorage.setItem('scriptforge_paper_cache_' + paper.id, dataUrl)
    // 让 UI 知道缓存好了——触发 paperVersion 变化
    window.dispatchEvent(new CustomEvent('paper-cache-ready', { detail: { id: paper.id } }))
  } catch (err) {
    console.warn('[paperLibrary] fetch 在线稿纸失败：', paper.id, err.message)
  } finally {
    _fetching[paper.id] = false
  }
}

// 获取当前选中的稿纸（builtin 或 custom）
export function getActivePaper() {
  const activeId = localStorage.getItem('scriptforge_paper') || 'builtin-plain'
  if (activeId.startsWith('builtin-')) {
    return BUILTIN_PAPERS.find(p => p.id === activeId) || BUILTIN_PAPERS[0]
  }
  // 自定义稿纸
  const list = JSON.parse(localStorage.getItem('scriptforge_papers_custom') || '[]')
  return list.find(p => p.id === activeId) || BUILTIN_PAPERS[0]
}

// 保存/切换稿纸
export function setActivePaper(id) {
  localStorage.setItem('scriptforge_paper', id)
}

// 添加自定义稿纸（id 自动生成 custom-xxx）
export function addCustomPaper({ name, dataUrl }) {
  const list = JSON.parse(localStorage.getItem('scriptforge_papers_custom') || '[]')
  const paper = {
    id: 'custom-' + Date.now().toString(36),
    name: name || '自定义稿纸',
    background: dataUrl,
    backgroundColor: '#E8E2D5',
    isCustom: true,
  }
  list.push(paper)
  localStorage.setItem('scriptforge_papers_custom', JSON.stringify(list))
  setActivePaper(paper.id)
  return paper
}

// 删除自定义稿纸
export function removeCustomPaper(id) {
  let list = JSON.parse(localStorage.getItem('scriptforge_papers_custom') || '[]')
  list = list.filter(p => p.id !== id)
  localStorage.setItem('scriptforge_papers_custom', JSON.stringify(list))
  // 如果删的是当前激活的，切回默认
  const activeId = localStorage.getItem('scriptforge_paper')
  if (activeId === id) setActivePaper('builtin-plain')
}

// 获取所有稿纸（内置 + 自定义）
export function getAllPapers() {
  const custom = JSON.parse(localStorage.getItem('scriptforge_papers_custom') || '[]')
  return [...BUILTIN_PAPERS, ...custom]
}

// 压缩用户上传图到 max 2048px → dataURL
export function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const MAX = 2048
        let { width, height } = img
        if (width > height && width > MAX) { height = Math.round(height * MAX / width); width = MAX }
        else if (height > MAX) { width = Math.round(width * MAX / height); height = MAX }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.88))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}
