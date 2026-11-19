import { useEffect, useRef, useState } from 'react'
import { Upload, Trash2, Image as ImageIcon, Check } from 'lucide-react'
import { getAllPapers, getActivePaper, setActivePaper, addCustomPaper, removeCustomPaper, compressImage } from '../utils/paperLibrary.js'

export default function PaperPicker({ onClose, onChange }) {
  const [papers, setPapers] = useState(getAllPapers())
  const [activeId, setActiveId] = useState(getActivePaper().id)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const pick = (id) => {
    setActiveId(id)
    setActivePaper(id)
    onChange?.()
    // 不自动关闭，方便用户连续试
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('只支持图片文件'); return }
    setUploading(true)
    try {
      const dataUrl = await compressImage(file)
      addCustomPaper({ name: file.name.replace(/\.[^.]+$/, ''), dataUrl })
      setPapers(getAllPapers())
      setActiveId(getActivePaper().id)
      onChange?.()
    } catch (err) {
      alert('图片处理失败：' + err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const del = (id) => {
    if (!confirm('删除这张自定义稿纸？')) return
    removeCustomPaper(id)
    setPapers(getAllPapers())
    setActiveId(getActivePaper().id)
    onChange?.()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[640px] max-w-full bg-noir-800 border border-gold-500/40 shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="px-5 py-3 border-b border-noir-700 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-gold-500/80">Paper</div>
            <div className="text-ivory-100 font-medium">自定义稿纸</div>
          </div>
          <button
            className="px-3 py-1.5 border border-gold-500/50 hover:border-gold-500 text-gold-400 text-xs flex items-center gap-1.5 transition-colors"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={12} />
            {uploading ? '处理中…' : '上传图片'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleUpload}
          />
        </div>

        {/* 网格 */}
        <div className="p-5 max-h-[420px] overflow-y-auto scroll-noir">
          <div className="grid grid-cols-3 gap-3">
            {papers.map(p => {
              const isActive = p.id === activeId
              const isCustom = p.isCustom
              // 取预览背景：优先 background，其次 localStorage 缓存的 remoteUrl 图，再其次 preview CSS/纯色
              let bgVal = p.background
              if (!bgVal && p.remoteUrl) {
                const cached = localStorage.getItem('scriptforge_paper_cache_' + p.id)
                bgVal = cached || p.preview // preview 是 CSS gradient 字符串
              }
              const hasBg = !!bgVal
              const isCssGrad = typeof bgVal === 'string' && bgVal.includes('gradient')
              const isUrl = bgVal && (bgVal.startsWith('data:') || bgVal.startsWith('http'))

              return (
                <div
                  key={p.id}
                  className={`relative group cursor-pointer transition-all ${isActive ? 'ring-2 ring-gold-500' : 'ring-1 ring-noir-600 hover:ring-noir-500'}`}
                  onClick={() => pick(p.id)}
                >
                  {/* 预览框 */}
                  <div
                    className="aspect-[8.5/11] relative overflow-hidden"
                    style={{
                      backgroundImage: isUrl ? `url(${bgVal})` : (isCssGrad ? bgVal : undefined),
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundColor: p.backgroundColor || '#E8E2D5',
                    }}
                  >
                    {/* 纸张微噪点覆盖 */}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        boxShadow: 'inset 0 0 40px rgba(0,0,0,0.08)',
                        border: '1px solid rgba(0,0,0,0.06)',
                      }}
                    />
                    {/* 选中勾 */}
                    {isActive && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-gold-500 text-noir-900 flex items-center justify-center">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}
                    {/* 删除按钮（自定义） */}
                    {isCustom && (
                      <button
                        className="absolute top-1.5 left-1.5 w-5 h-5 bg-black/50 hover:bg-red-500 border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); del(p.id) }}
                        title="删除"
                      >
                        <Trash2 size={10} className="text-white" />
                      </button>
                    )}
                  </div>
                  {/* 名字 */}
                  <div className="py-1.5 px-2 bg-noir-900/60 text-[10px] tracking-wide text-ivory-200 text-center truncate flex items-center justify-center gap-1">
                    {isCustom && <ImageIcon size={9} className="text-gold-500/60" />}
                    {p.name}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 底部说明 */}
        <div className="px-5 py-2.5 border-t border-noir-700/50 text-[10px] text-ivory-500 leading-relaxed">
          支持 JPG / PNG / WEBP，建议比例接近 A4（210×297mm）。上传后自动压缩到 2048px 以内。选中的稿纸会应用到编辑器并随 PDF 导出。
        </div>
      </div>
    </div>
  )
}
