import React, { useState, useEffect } from 'react'
import { Upload, Trash2, ImagePlus } from 'lucide-react'
import {
  ART_BACKGROUNDS, getCustomArts, saveCustomArt,
  deleteCustomArt, fileToArtDataURL
} from '../utils/artLibrary.js'
import { useI18n } from '../i18n/index.jsx'

const STORAGE_KEY = 'scriptforge_wallpaper'

export function loadWallpaper() {
  try { return localStorage.getItem(STORAGE_KEY) || null } catch { return null }
}
export function saveWallpaper(id) {
  if (id) localStorage.setItem(STORAGE_KEY, id)
  else localStorage.removeItem(STORAGE_KEY)
}

export default function WallpaperPicker({ currentId, onSelect, onClose }) {
  const { t } = useI18n()
  const [customArts, setCustomArts] = useState(() => getCustomArts())
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { setCustomArts(getCustomArts()) }, [])

  const handleUpload = async (file) => {
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const dataURL = await fileToArtDataURL(file, 1600, 0.82)
      const newArt = saveCustomArt({ title: file.name.replace(/\.[^.]+$/, ''), url: dataURL })
      setCustomArts(getCustomArts())
      // 自动选中新上传的
      onSelect(newArt.id)
    } catch (e) {
      setError(e.message || t('上传失败'))
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = (id, e) => {
    e.stopPropagation()
    if (!confirm(t('确定删除这张自定义壁纸？'))) return
    deleteCustomArt(id)
    setCustomArts(getCustomArts())
    if (currentId === id) onSelect(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div className="modal-backdrop absolute inset-0" />
      <div
        className="relative z-10 card-noir art-corner p-8 max-w-5xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold-500 mb-2">Art Library</div>
            <h2 className="headline text-3xl text-ivory-100">{t('画作壁纸库')}</h2>
            <p className="text-[11px] uppercase tracking-[0.2em] text-ivory-400 mt-1">
              {t('公有领域名画 · 高清 · {n} 内置 · {m} 自定义', { n: ART_BACKGROUNDS.length, m: customArts.length })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* 上传按钮 */}
            <label className="btn-gold text-[10px] uppercase tracking-[0.2em] py-2 px-4 cursor-pointer inline-flex items-center gap-2">
              <ImagePlus size={14} />
              {uploading ? t('上传中...') : t('上传图片')}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={e => handleUpload(e.target.files?.[0])}
              />
            </label>
            <button
              onClick={() => onSelect(null)}
              className="btn-outline text-[10px] uppercase tracking-[0.2em] py-2 px-4"
            >
              {t('关闭壁纸')}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/40 text-red-300 text-xs">
            {error}
          </div>
        )}

        <div className="hairline mb-6" />

        {/* 网格 */}
        <div className="flex-1 overflow-y-auto scroll-noir">
          {/* 自定义壁纸区 */}
          {customArts.length > 0 && (
            <div className="mb-6">
              <div className="text-[10px] uppercase tracking-[0.25em] text-gold-500 mb-3 flex items-center gap-2">
                <Upload size={12} /> {t('我的壁纸 ({n})', { n: customArts.length })}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {customArts.map(art => (
                  <ArtCard
                    key={art.id}
                    art={art}
                    selected={art.id === currentId}
                    onSelect={onSelect}
                    onDelete={(e) => handleDelete(art.id, e)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 内置壁纸区 */}
          <div className="text-[10px] uppercase tracking-[0.25em] text-gold-500 mb-3">
            {t('内置艺术库 ({n})', { n: ART_BACKGROUNDS.length })}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {ART_BACKGROUNDS.map(art => (
              <ArtCard
                key={art.id}
                art={art}
                selected={art.id === currentId}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>

        <div className="hairline mt-6 mb-4" />
        <div className="text-center text-[9px] uppercase tracking-[0.25em] text-ivory-400">
          {t('内置图：Wikimedia Commons 公有领域名画 / 氛围摄影为 Unsplash CC0 / 自定义图本地保存，不上传服务器')}
        </div>
      </div>
    </div>
  )
}

function ArtCard({ art, selected, onSelect, onDelete }) {
  const { t } = useI18n()
  // 网格里只解码缩略图，避免一次拉 24 张 2000px 大图造成滚动卡顿
  const thumb = art.thumb || art.url.replace(/([?&])w=\d+/, '$1w=640')
  return (
    <button
      onClick={() => onSelect(art.id)}
      className={`group relative aspect-[4/3] overflow-hidden transition-all duration-500 ${
        selected ? 'ring-2 ring-gold-500 scale-[1.02]' : 'hover:scale-[1.02] border border-noir-600 hover:border-gold-500/50'
      }`}
    >
      <img
        src={thumb}
        alt={art.title}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        onError={(e) => {
          // 失败时显示占位色块 + 标题
          e.currentTarget.style.display = 'none'
          const holder = e.currentTarget.nextElementSibling
          if (holder) holder.style.background = 'linear-gradient(135deg,#2A2420,#1a1410)'
        }}
      />
      {/* 暗化层 */}
      <div className="absolute inset-0 bg-gradient-to-t from-noir-950 via-noir-950/20 to-transparent" />

      {/* 选中金框 */}
      {selected && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-2 left-2 text-[9px] uppercase tracking-[0.2em] bg-gold-500 text-noir-900 px-2 py-0.5">
            {t('· 当前 ·')}
          </div>
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-gold-500" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-gold-500" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-gold-500" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-gold-500" />
        </div>
      )}

      {/* 自定义删除按钮 */}
      {art.custom && onDelete && (
        <button
          onClick={onDelete}
          className="absolute top-2 right-2 p-1.5 bg-noir-900/80 hover:bg-red-500 text-ivory-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
          title={t('删除')}
        >
          <Trash2 size={12} />
        </button>
      )}

      {/* 元信息 */}
      <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
        <div className="headline text-[15px] text-ivory-100 leading-tight">{art.title}</div>
        <div className="text-[10px] uppercase tracking-[0.15em] text-gold-500/80 mt-1">
          {art.artist} {art.year && `· ${art.year}`}
        </div>
        <div className="text-[9px] uppercase tracking-[0.2em] text-ivory-400 mt-0.5">
          {art.style}
        </div>
      </div>
    </button>
  )
}
