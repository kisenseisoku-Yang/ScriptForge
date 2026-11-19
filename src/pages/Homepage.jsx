import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import CheckoutModal from '../components/CheckoutModal.jsx'
import { PLAN_BY_ID } from '../utils/plans.js'
import { usePageSeo } from '../utils/seo.js'
import {
  ArrowRight, Play, Sparkles, Film, BookOpen, Palette,
  Cpu, PenLine, Image, Menu, X, Quote, Heart, CheckCircle, Mail
} from 'lucide-react'

const FILM_SCRATCH =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

const NAV = [
  { label: '首页', en: 'Home', target: 'top' },
  { label: '帧', en: 'Frames', target: 'frames' },
  { label: '工坊', en: 'Atelier', target: 'atelier' },
  { label: '产品', en: 'Product', target: 'product' },
  { label: '套餐', en: 'Pricing', target: 'pricing' },
  { label: '订阅', en: 'Subscribe', target: 'subscribe' },
]

const GALLERY = [
  { src: '/home/frames/frames-seagull.webp',    label: '海与海鸥',   en: 'Seagull & Sea' },
  { src: 'https://images.unsplash.com/photo-1578321272176-b7bbc0679853?auto=format&fit=crop&w=1400&q=80', label: '戴珍珠耳环的少女', en: 'Girl with a Pearl Earring', artist: 'Vermeer · 1665' },
  { src: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1400&q=80', label: '胶片卷轴', en: 'Film Reel' },
  { src: 'https://images.unsplash.com/photo-1502139214982-d0ad755818d8?auto=format&fit=crop&w=1400&q=80', label: '导演椅', en: 'Director' },
  { src: 'https://images.unsplash.com/photo-1545179605-1296651e9d43?auto=format&fit=crop&w=1400&q=80', label: '睡莲', en: 'Water Lilies', artist: 'after Monet' },
  { src: '/home/frames/frames-antenna.webp',    label: '天线',       en: 'Antenna' },
  { src: 'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=1400&q=80', label: '明暗对照', en: 'Chiaroscuro', artist: 'Caravaggio 氛围' },
  { src: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1400&q=80', label: '放映厅', en: 'Cinema' },
  { src: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1400&q=80', label: '暗金肖像', en: 'Portrait in Dark Gold', artist: 'Rembrandt 氛围' },
  { src: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1400&q=80', label: '胶片齿孔', en: 'Film Strip' },
  { src: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1400&q=80', label: '室内光', en: 'Interior Light', artist: '荷兰画派' },
  { src: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1400&q=80', label: '光', en: 'Light' },
  { src: 'https://images.unsplash.com/photo-1502977249166-824b3a8a4d6d?auto=format&fit=crop&w=1400&q=80', label: '紫鸢尾', en: 'Irises', artist: 'after Van Gogh' },
  { src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1400&q=80', label: '山与雾', en: 'Mountain Mist' },
]
// 大图格（col-span-2 row-span-2）位置：0 海与海鸥 / 5 天线 —— 形成头尾重音
const GALLERY_SPANS = [
  'lg:row-span-2 lg:col-span-2', '', '', '', '', 'lg:row-span-2 lg:col-span-2', '', '', '', '', '', '', '', '',
]

const FEATURES = [
  { icon: PenLine,  title: '剧本编辑器',   en: 'Script Editor',   desc: '六种行业格式：好莱坞、Netflix、BBC、中国广电、Fountain、自由格式', enDesc: 'Six industry formats — Hollywood, Netflix, BBC, China NRTA, Fountain, Freeform' },
  { icon: Film,     title: '分镜工作台',   en: 'Storyboard',      desc: '电影帧、日式 ekonte、中式动画格、电子表格四种视图', enDesc: 'Film frames, Japanese ekonte, Chinese animation cel, spreadsheet — four views' },
  { icon: BookOpen, title: '剧本架',       en: 'Script Shelf',    desc: '收藏你的作品库：上传封面、按类型分组、导入 .fountain', enDesc: 'Curate your library — upload covers, organize by genre, import .fountain' },
  { icon: Palette,  title: '壁纸画廊',     en: 'Wallpaper',       desc: '大都会、维基共享等公共领域大师名作', enDesc: 'Public-domain masterpieces from the Met, Wikimedia and more' },
  { icon: Cpu,      title: '自动审稿',     en: 'Auto Audit',      desc: '实时格式检查、场头检测、页数预估、角色提取', enDesc: 'Real-time format checks, slugline detection, page timing, character extraction' },
  { icon: Image,    title: '帧图像导入',   en: 'Frame Image',     desc: '把参考图拖进分镜卡片，自动压缩', enDesc: 'Drop reference photos into storyboard cards — auto-compressed' },
]

const PRODUCT_HIGHLIGHTS = [
  { num: '01', zh: '电影美学', en: 'Cinematic Aesthetic', text: '工具本身就是一部电影：低饱和、暖金色、衬线字体，从每个像素里看到胶片颗粒', enText: 'The tool itself is a film — muted tones, warm gold, serif type, grain in every pixel.' },
  { num: '02', zh: '专业排版', en: 'Pro Formatting',      text: '不是富文本玩具：场头、角色、括号、转场自动推断，一页剧本一秒排好', enText: 'Not a toy editor — sluglines, characters, parentheticals and transitions auto-classified.' },
  { num: '03', zh: '桌面陪伴', en: 'Companion',           text: '一位叫斧头的女编剧老师会在你卡壳时跳出来，讲两句、审稿、帮你算字数', enText: 'A quiet companion named Futou — speaks, audits, tracks your word count.' },
]

// 帧画廊卡片：滚动进入 + 指针视差 + 金色扫光
function FrameCard({ item, index, spans }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.classList.add('is-visible')
        io.disconnect()
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const onMove = (e) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5) * 2)
    el.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5) * 2)
  }
  const onLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--px', 0)
    el.style.setProperty('--py', 0)
  }

  const isLocal = item.src.startsWith('/home')
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`frame-card group relative overflow-hidden bg-black ${spans}`}
      style={{ aspectRatio: spans ? '4/3' : '4/5', transitionDelay: `${(index % 4) * 90}ms` }}
    >
      <div className="frame-tilt">
        <img
          src={item.src} alt={item.label} loading="lazy" referrerPolicy={isLocal ? undefined : 'no-referrer'}
          className="frame-media"
          style={{ filter: isLocal ? 'brightness(0.85) contrast(1.02) saturate(0.88)' : 'brightness(0.55) contrast(1.05) saturate(0.85)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0C0C0F]/90 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500" />
        <div className="frame-sheen" />
        <div className="absolute top-3 right-3 text-[10px] tracking-[0.2em] text-[#B89768]/80">{String(index + 1).padStart(2, '0')}</div>
        <div className="frame-cap absolute bottom-4 left-4 right-4">
          <div className="frame-line h-[1px] bg-[#B89768]/70 mb-2" />
          <div className="font-serif text-base text-[#F4F1EA]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{item.label}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#B89768]/70 mt-0.5">{item.en}</div>
          {item.artist && (
            <div className="text-[10px] tracking-[0.12em] text-[#F4F1EA]/45 mt-1">{item.artist}</div>
          )}
        </div>
        <div className="absolute inset-0 border border-[#B89768]/0 group-hover:border-[#B89768]/40 transition-colors duration-500 pointer-events-none" />
      </div>
    </div>
  )
}

export default function Homepage() {
  const navigate = useNavigate()
  usePageSeo({
    title: '幕后 · 文字剧场 | 电影剧本写作与分镜工作台',
    description: '幕后 · 文字剧场：电影美学剧本写作工具。6 套行业剧本格式（好莱坞、Netflix、BBC、中国广电、Fountain、自由格式）、分镜工作台、剧本架与公共领域名画壁纸。',
  })
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [checkoutPlan, setCheckoutPlan] = useState(null)
  const trialPlan = PLAN_BY_ID.trial
  const annualPlan = PLAN_BY_ID.annual
  const lifetimePlan = PLAN_BY_ID.lifetime

  const scrollTo = (id) => {
    if (id === 'top') { window.scrollTo({ top: 0, behavior: 'smooth' }) }
    else { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }
    setMobileMenu(false)
  }
  const toStudio = () => navigate('/studio')

  const handleSubscribe = (e) => {
    e.preventDefault()
    if (email && /@/.test(email)) {
      setSubscribed(true)
      setEmail('')
    }
  }

  return (
    <div className="bg-[#0C0C0F] text-[#F4F1EA] antialiased overflow-x-hidden"
         style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ============ HERO ============ */}
      <section id="top" className="relative min-h-screen flex flex-col overflow-hidden">
        {/* 主背景 —— 用户 DV 剧照 */}
        <div
          className="absolute inset-0 bg-center bg-cover"
          style={{ backgroundImage: "url('/home/hero-family-dark.webp')" }}
        />
        {/* 上层：原图（保留一点彩色暖调）+ 整体黑金 overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0C0C0F]/40 via-[#0C0C0F]/20 to-[#0C0C0F]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0C0C0F]/70 via-[#0C0C0F]/30 to-transparent" />
        {/* 金色侧光 */}
        <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-[#B89768]/20 via-transparent to-transparent pointer-events-none" />
        {/* 胶片噪点 */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay"
             style={{ backgroundImage: FILM_SCRATCH }} />

        {/* DV HUD —— 左上 PLAY（下移，避免与品牌字标重叠） */}
        <div className="absolute top-28 md:top-32 left-8 md:left-16 z-30 text-[#F4F1EA]/80 select-none">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 animate-pulse rounded-sm" />
            <span className="text-[11px] font-bold tracking-[0.1em]">REC</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[18px] font-black tracking-tight" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            <span className="w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[14px] border-l-[#B89768]" />
            <span className="text-[#B89768] italic text-2xl">PLAY</span>
          </div>
        </div>

        {/* DV HUD —— 左下角时间戳 */}
        <div className="absolute bottom-24 md:bottom-28 left-8 md:left-16 z-30 text-[#F4F1EA]/70 select-none">
          <div className="text-[11px] tracking-[0.2em]">JAN. 14 2004</div>
          <div className="text-[22px] font-bold tracking-widest text-[#F4F1EA]">PM 03:27:16</div>
        </div>

        {/* 时间码 */}
        <div className="absolute bottom-24 md:bottom-28 right-8 md:right-16 z-30 text-[11px] tracking-[0.2em] text-[#B89768]/80 select-none text-right">
          <div>00:12:47 / 01:28:33</div>
          <div className="mt-1 text-[#F4F1EA]/40">480i · SP · LP</div>
        </div>

        {/* ===== NAV ===== */}
        <nav className="relative z-20 w-full max-w-7xl mx-auto px-6 lg:px-12 py-6 flex items-center justify-between">
          <button
            onClick={() => scrollTo('top')}
            className="brand-lockup"
            aria-label="幕后 · 文字剧场"
          >
            <span className="brand-bar" aria-hidden="true" />
            <span className="brand-text">
              <span className="brand-cn">
                <span className="brand-cn-main">幕</span>
                <span className="brand-cn-accent">后</span>
              </span>
              <span className="brand-sub">
                <span className="brand-sub-rule" aria-hidden="true" />
                <span>BEHIND THE SCENES</span>
              </span>
            </span>
          </button>

          <div className="hidden md:flex items-center gap-8 text-[11px] tracking-[0.25em]">
            {NAV.map((item, i) => (
              <button
                key={item.label}
                onClick={() => scrollTo(item.target)}
                className={`pb-1 transition-colors duration-300 text-center ${
                  i === 0 ? 'text-[#B89768]' : 'text-[#F4F1EA]/50 hover:text-[#F4F1EA]'
                }`}
              >
                <div>{item.label}</div>
                <div className="text-[9px] text-[#F4F1EA]/30">{item.en}</div>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toStudio}
              className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 text-[11px] uppercase tracking-[0.25em] text-[#0C0C0F] bg-[#B89768] hover:bg-[#D4B483] transition-all duration-300 border border-[#B89768]"
            >
              进入工坊 Enter
            </button>
            <button
              onClick={() => setMobileMenu(!mobileMenu)}
              className="md:hidden w-10 h-10 flex items-center justify-center border border-[#B89768]/40 text-[#F4F1EA]"
            >
              {mobileMenu ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </nav>

        {mobileMenu && (
          <div className="fixed inset-0 z-30 bg-[#0C0C0F]/98 backdrop-blur-xl flex flex-col items-center justify-center gap-8 animate-[fadeIn_0.5s_ease-out]" onClick={() => setMobileMenu(false)}>
            {NAV.map(item => (
              <button key={item.label} onClick={() => scrollTo(item.target)}
                className="flex flex-col items-center">
                <span className="font-serif text-3xl text-[#F4F1EA]/90" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{item.label}</span>
                <span className="text-[10px] tracking-[0.3em] text-[#B89768]/60 mt-1">{item.en}</span>
              </button>
            ))}
          </div>
        )}

        {/* ===== Hero 主内容 ===== */}
        <div className="relative z-20 w-full max-w-7xl mx-auto px-6 lg:px-12 flex-1 flex flex-col justify-center my-auto py-12">
          <div className="max-w-4xl space-y-7 animate-[fadeInUp_1.4s_ease-out_both]">

            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B89768] animate-pulse shadow-[0_0_12px_2px_rgba(184,151,104,0.6)]" />
              <span className="text-[10px] uppercase tracking-[0.4em] text-[#B89768]">字 · 帧 · 光影</span>
              <span className="text-[10px] uppercase tracking-[0.3em] text-[#F4F1EA]/40">Text · Frame · Cinema</span>
            </div>

            <h1 className="hero-headline">
              <span className="hero-headline-line">
                当文字<span className="hero-headline-mark" aria-hidden="true" />
              </span>
              <span className="hero-headline-line hero-headline-line-2">
                成为<span className="hero-headline-accent">镜头</span>
              </span>
            </h1>

            <div className="w-24 h-[1px] bg-[#B89768]/40" />

            <div className="space-y-1">
              <p className="text-[15px] md:text-base text-[#F4F1EA]/75 leading-relaxed font-medium" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                幕 · 电影美学编剧工作台。给每一个想写剧本的人一间可以待到凌晨的房间。
              </p>
              <p className="text-[11px] uppercase tracking-[0.25em] text-[#F4F1EA]/45">
                A cinematic atelier for writers and directors —
                six industry formats, storyboard frames, a bookshelf, and a quiet reverence for cinema.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-4">
              <button
                onClick={toStudio}
                className="group inline-flex items-center gap-3 px-7 py-3.5 text-[12px] uppercase tracking-[0.25em] font-medium text-[#0C0C0F] bg-[#B89768] hover:bg-[#D4B483] border border-[#B89768] shadow-[0_0_40px_-5px_rgba(184,151,104,0.5)] transition-all duration-300"
              >
                开始写作
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => setShowVideoModal(true)}
                className="inline-flex items-center gap-3 px-6 py-3.5 text-[12px] uppercase tracking-[0.25em] font-medium text-[#F4F1EA] bg-transparent hover:bg-[#F4F1EA]/5 border border-[#F4F1EA]/20 transition-all duration-300"
              >
                <span className="w-6 h-6 rounded-full border border-[#F4F1EA]/40 text-[#F4F1EA] flex items-center justify-center">
                  <Play size={9} className="ml-0.5" />
                </span>
                观看影片 Watch
              </button>
            </div>

          </div>
        </div>

        {/* 滚动提示 */}
        <div className="relative z-20 w-full max-w-7xl mx-auto px-6 lg:px-12 pb-6 pt-2 flex items-center justify-center flex-col gap-2">
          <span className="text-[9px] uppercase tracking-[0.35em] text-[#B89768]/60">滚动 / Scroll</span>
          <div className="w-[1px] h-6 bg-gradient-to-b from-[#B89768]/60 to-transparent" />
        </div>
      </section>

      {/* ============ FRAMES ============ */}
      <section id="frames" className="relative py-28 bg-[#0C0C0F]">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#B89768]/30 to-transparent" />
        <div className="max-w-7xl mx-auto px-6 lg:px-12">

          <div className="max-w-3xl mb-16">
            <div className="text-[10px] uppercase tracking-[0.4em] text-[#B89768] mb-4">— 帧 · The Frames</div>
            <h2 className="font-serif text-4xl md:text-5xl text-[#F4F1EA] leading-tight" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              光与沉默<br />
              <span className="italic font-normal text-[#B89768]">Fourteen Studies in Light &amp; Silence</span>
            </h2>
            <p className="mt-6 text-[#F4F1EA]/60 leading-relaxed">
              电影边缘的静照 —— 摄影机对准的那一瞬间，快门始终没有完全合上。
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 grid-flow-dense gap-4">
            {GALLERY.map((item, i) => (
              <FrameCard key={i} item={item} index={i} spans={GALLERY_SPANS[i] || ''} />
            ))}
          </div>
        </div>
      </section>

      {/* ============ THE ATELIER 工作台 ============ */}
      <section id="atelier" className="relative py-28 bg-[#121218] overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[#B89768]/5 blur-[200px] pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#B89768]/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#B89768]/20 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-12">
          <div className="max-w-3xl mb-16">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={12} className="text-[#B89768]" />
              <span className="text-[10px] uppercase tracking-[0.4em] text-[#B89768]">— 工坊 · The Atelier</span>
            </div>
            <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] text-[#F4F1EA]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              <span className="italic font-normal text-[#B89768]">幕后</span> · 文字剧场<br />
              <span className="text-[#F4F1EA]/70 font-light">A Workbench for Cinema</span>
            </h2>
            <p className="mt-6 text-[#F4F1EA]/60 text-lg leading-relaxed max-w-2xl" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              一间 Film-Noir 工作室：字成剧本、剧本成分镜、分镜成电影。
              六种行业格式、电影级分镜、书架、壁纸墙 —— 给每一个故事一个像样的开场。
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#B89768]/10 mb-16">
            {FEATURES.map((f, i) => (
              <div key={i} className="group p-8 bg-[#121218] hover:bg-[#16161E] transition-colors duration-500">
                <div className="w-10 h-10 flex items-center justify-center mb-6 border border-[#B89768]/30 text-[#B89768] group-hover:border-[#B89768] transition-colors">
                  <f.icon size={16} />
                </div>
                <div className="font-serif text-xl text-[#F4F1EA]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{f.title}</div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#B89768]/70 mt-0.5">{f.en}</div>
                <div className="text-sm text-[#F4F1EA]/55 leading-relaxed mt-3">{f.desc}</div>
                <div className="text-[11px] text-[#F4F1EA]/35 leading-relaxed mt-1">{f.enDesc}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={toStudio}
              className="group inline-flex items-center gap-3 px-8 py-4 text-[12px] uppercase tracking-[0.3em] font-medium text-[#0C0C0F] bg-[#B89768] hover:bg-[#D4B483] shadow-[0_0_50px_-10px_rgba(184,151,104,0.6)] transition-all duration-300"
            >
              进入工坊 Enter The Atelier
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <span className="text-[11px] uppercase tracking-[0.25em] text-[#F4F1EA]/40">Free · 6 Formats · No Watermarks</span>
          </div>
        </div>
      </section>

      {/* ============ 产品单独介绍板块（NEW） ============ */}
      <section id="product" className="relative py-28 bg-[#0C0C0F] overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#B89768]/30 to-transparent" />

        <div className="max-w-7xl mx-auto px-6 lg:px-12">

          {/* 顶部标题 */}
          <div className="text-center mb-20">
            <div className="text-[10px] uppercase tracking-[0.5em] text-[#B89768] mb-4">— 产品介绍 · The Product</div>
            <h2 className="font-serif text-5xl md:text-7xl text-[#F4F1EA] leading-tight" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              一件<span className="italic text-[#B89768]">为写剧本而生</span>的工具<br />
              <span className="text-[#F4F1EA]/60 font-light text-xl md:text-2xl tracking-wide">A tool that was always a film.</span>
            </h2>
          </div>

          {/* 左：DV 剧照（用户照片） + 金色 Art Deco 框 —— 作为产品的视觉象征 */}
          <div className="grid lg:grid-cols-5 gap-16 items-start">
            <div className="lg:col-span-2 relative">
              <div className="aspect-[4/3] relative overflow-hidden bg-black">
                <img
                  src="/home/hero-family.webp" alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ filter: 'brightness(0.75) contrast(1.05) saturate(0.9)' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0C0C0F] via-transparent to-transparent" />

                {/* 金色 Art Deco 四角 */}
                <div className="absolute top-4 left-4 w-6 h-6 border-t border-l border-[#B89768]/70" />
                <div className="absolute top-4 right-4 w-6 h-6 border-t border-r border-[#B89768]/70" />
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b border-l border-[#B89768]/70" />
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b border-r border-[#B89768]/70" />

                {/* DV HUD 叠加 */}
                <div className="absolute top-6 left-6 text-[#F4F1EA]/80 text-[10px] tracking-[0.25em] flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-sm animate-pulse" /> REC · DV · AU 24P
                </div>
                <div className="absolute bottom-6 right-6 text-[#B89768] text-[10px] tracking-[0.25em]">+03°  1/48  f/1.8</div>
              </div>

              <div className="mt-6 space-y-1">
                <div className="text-[9px] uppercase tracking-[0.4em] text-[#B89768]">作品截图 · Studio Portrait</div>
                <div className="font-serif text-xl text-[#F4F1EA]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                  每一张剧照，都是一个未写完的场景
                </div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#F4F1EA]/40">Every still is an unfinished scene.</div>
              </div>
            </div>

            {/* 右：三大亮点 01 / 02 / 03 */}
            <div className="lg:col-span-3 space-y-12">
              {PRODUCT_HIGHLIGHTS.map((h) => (
                <div key={h.num} className="group">
                  <div className="flex items-start gap-6">
                    <div className="font-serif text-[56px] leading-none text-[#B89768]/30 group-hover:text-[#B89768]/70 transition-colors"
                         style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{h.num}</div>
                    <div className="flex-1 pt-1">
                      <div className="flex items-baseline gap-3 mb-3">
                        <h3 className="font-serif text-2xl text-[#F4F1EA]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{h.zh}</h3>
                        <span className="text-[10px] uppercase tracking-[0.25em] text-[#B89768]/70">{h.en}</span>
                      </div>
                      <p className="text-[#F4F1EA]/70 leading-relaxed mb-1">{h.text}</p>
                      <p className="text-[11px] text-[#F4F1EA]/40 leading-relaxed italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{h.enText}</p>
                    </div>
                  </div>
                </div>
              ))}

              {/* 功能清单 */}
              <div className="pt-6 border-t border-[#B89768]/15">
                <div className="text-[10px] uppercase tracking-[0.4em] text-[#B89768] mb-4">— 亮点清单 · What's Included</div>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                  {[
                    { zh: '六套行业格式', en: '6 Industry Formats' },
                    { zh: '电影级分镜视图', en: 'Cinema Storyboard' },
                    { zh: '剧本架 / .fountain 导入', en: 'Shelf · .fountain Import' },
                    { zh: '自动审稿 / 角色提取', en: 'Auto Audit · Character Extract' },
                    { zh: 'PDF / Fountain / DOCX 导出', en: 'PDF · Fountain · DOCX Export' },
                    { zh: '桌面陪伴斧头', en: 'Writing Companion Futou' },
                    { zh: '公共领域壁纸画廊', en: 'Public-Domain Wallpaper' },
                    { zh: '部署后立即可用', en: 'Deploy & Use Instantly' },
                  ].map((it, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-[#F4F1EA]/70">
                      <CheckCircle size={12} className="text-[#B89768] flex-shrink-0" />
                      <span>{it.zh}</span>
                      <span className="text-[#F4F1EA]/35 italic text-[11px]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>· {it.en}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 作者 ============ */}
      <section id="author" className="relative py-28 bg-[#0C0C0F]">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#B89768]/30 to-transparent" />
        <div className="max-w-7xl mx-auto px-6 lg:px-12 grid lg:grid-cols-5 gap-16 items-center">

          {/* 左：作者肖像 */}
          <div className="lg:col-span-2 relative order-2 lg:order-1">
            <div className="aspect-[4/5] relative overflow-hidden bg-black">
              <img
                src="/home/author-portrait.webp" alt=""
                className="absolute inset-0 w-full h-full object-cover object-center"
                style={{ filter: 'brightness(0.8) contrast(1.02) saturate(0.92)' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0C0C0F] via-[#0C0C0F]/30 to-transparent" />

              {/* 金色 Art Deco 四角 */}
              <div className="absolute top-4 left-4 w-6 h-6 border-t border-l border-[#B89768]/70" />
              <div className="absolute top-4 right-4 w-6 h-6 border-t border-r border-[#B89768]/70" />
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b border-l border-[#B89768]/70" />
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b border-r border-[#B89768]/70" />

              {/* DV HUD 叠加 */}
              <div className="absolute top-6 left-6 text-[#F4F1EA]/75 text-[10px] tracking-[0.2em]">
                <div className="flex items-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-sm animate-pulse" /> REC</div>
                <div className="text-[11px] tracking-[0.15em] mt-1">JAN. 14 2004</div>
              </div>
              <div className="absolute bottom-6 left-6 text-[#F4F1EA]">
                <div className="text-[9px] uppercase tracking-[0.35em] text-[#B89768]/70">肖像 · Portrait</div>
                <div className="font-serif text-lg mt-1" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>after a day at the supermarket</div>
              </div>
            </div>

            {/* 数据卡 */}
            <div className="grid grid-cols-3 gap-px bg-[#B89768]/10 mt-6">
              {[
                { num: '6', zh: '格式', en: 'Formats' },
                { num: '8', zh: '亮点', en: 'Features' },
                { num: '∞', zh: '故事', en: 'Stories' },
              ].map(s => (
                <div key={s.zh} className="p-5 bg-[#0C0C0F]">
                  <div className="font-serif text-2xl text-[#B89768]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{s.num}</div>
                  <div className="text-[10px] text-[#F4F1EA]/60 mt-1">{s.zh}</div>
                  <div className="text-[9px] uppercase tracking-[0.2em] text-[#F4F1EA]/35">{s.en}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 右：文字 */}
          <div className="lg:col-span-3 order-1 lg:order-2">
            <div className="text-[10px] uppercase tracking-[0.4em] text-[#B89768] mb-4">— 关于 · The Author</div>
            <h2 className="font-serif text-4xl md:text-5xl text-[#F4F1EA] leading-tight mb-8" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              Kisen<span className="italic font-normal text-[#B89768]">Seisoku</span>
              <span className="block text-[18px] md:text-xl text-[#F4F1EA]/50 font-light tracking-wide mt-1" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>独立设计师 · 电影爱好者 · 自学开发者</span>
            </h2>

            <div className="relative pl-6 border-l border-[#B89768]/30 mb-8">
              <Quote size={16} className="absolute -left-2 top-0 text-[#B89768]/50" />
              <p className="text-lg text-[#F4F1EA]/80 leading-relaxed font-serif italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                "我写幕后，因为每个写剧本的人都值得一间把自己的字当电影帧对待的工作室 ——
                一个画廊般的静默、一个剪辑室般的精确、一个剧院般的温暖。"
              </p>
              <p className="text-[11px] text-[#F4F1EA]/45 italic mt-2" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                "I built 幕后 because every writer deserves a studio that treats their words like frames of film —
                with the quiet reverence of a gallery, the precision of an editing room, and the warmth of a theater."
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {['Film Noir', 'Typography', 'Architecture', 'Creative Code', 'Screenwriting', 'Art History'].map(t => (
                <span key={t} className="text-[10px] uppercase tracking-[0.2em] px-3 py-2 border border-[#B89768]/25 text-[#F4F1EA]/60">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ 套餐 PRICING ============ */}
      <section id="pricing" className="relative py-28 bg-[#0C0C0F] overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#B89768]/30 to-transparent" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full bg-[#B89768]/4 blur-[200px] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <div className="text-[10px] uppercase tracking-[0.5em] text-[#B89768] mb-4">— 套餐 · Pricing</div>
            <h2 className="font-serif text-5xl md:text-6xl text-[#F4F1EA] leading-tight" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              一间<span className="italic text-[#B89768]">长期开放</span>的工作室<br />
              <span className="text-[#F4F1EA]/50 font-light text-xl md:text-2xl tracking-wide">A studio that stays open.</span>
            </h2>
            <p className="mt-6 text-[#F4F1EA]/55 max-w-xl mx-auto leading-relaxed">
              时间是最好的答案，愿我们一道抵达最好的对岸。<br />
              Time is the best answer — may we reach the far shore together.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-px bg-[#B89768]/10 mb-10">

            {/* 免费 */}
            <div className="relative p-8 bg-[#0C0C0F]">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#F4F1EA]/40 mb-2">Trial · 试用</div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="font-serif text-5xl text-[#F4F1EA]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{trialPlan.price}</span>
                <span className="text-[11px] text-[#F4F1EA]/40">/ 7 天免费</span>
              </div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-[#F4F1EA]/50 mb-6">For curious writers.</div>
              <ul className="space-y-2.5 text-sm text-[#F4F1EA]/65">
                {[
                  '3 种基础格式（好莱坞 / Fountain / 自由）',
                  '分镜工作台 + 8 张参考帧',
                  '剧本架（本地）',
                  '桌面陪伴斧头（基础台词）',
                  '无水印导出 PDF / HTML',
                ].map((t, i) => (
                  <li key={i} className="flex items-start gap-2"><CheckCircle size={12} className="text-[#B89768] flex-shrink-0 mt-1" /> {t}</li>
                ))}
              </ul>
              <button
                onClick={toStudio}
                className="mt-8 w-full px-4 py-3 border border-[#B89768]/40 text-[#F4F1EA] text-[11px] uppercase tracking-[0.25em] hover:border-[#B89768] hover:text-[#B89768] transition-colors"
              >
                免费试用 Start Trial
              </button>
            </div>

            {/* Pro 年卡 —— 推荐 */}
            <div className="relative p-8 bg-[#111016] ring-1 ring-[#B89768]/60">
              <div className="absolute -top-px left-0 right-0 h-px bg-[#B89768]" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-0 px-3 py-1 bg-[#B89768] text-[#0C0C0F] text-[9px] uppercase tracking-[0.3em] font-medium">
                推荐 · Popular
              </div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#B89768] mb-2">Pro Annual · 包年</div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="font-serif text-5xl text-[#B89768]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{annualPlan.price}</span>
                <span className="text-[11px] text-[#F4F1EA]/40">{annualPlan.period}</span>
              </div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-[#F4F1EA]/50 mb-6">For working writers.</div>
              <ul className="space-y-2.5 text-sm text-[#F4F1EA]/85">
                {[
                  '全部 6 种行业格式',
                  '专业 PDF 排版（双孔装订 / 左侧安全区）',
                  'Fountain / DOCX / HTML 导出',
                  '分镜工作台全部视图',
                  '剧本架 + .fountain 导入',
                  '桌面陪伴斧头（完整审稿 + 专注计时器）',
                  '公共领域壁纸墙（40+ 大都会名作）',
                  '邮箱专属支持',
                ].map((t, i) => (
                  <li key={i} className="flex items-start gap-2"><CheckCircle size={12} className="text-[#B89768] flex-shrink-0 mt-1" /> {t}</li>
                ))}
              </ul>
              <button
                onClick={() => setCheckoutPlan(annualPlan)}
                className="mt-8 w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#B89768] hover:bg-[#D4B483] text-[#0C0C0F] text-[11px] uppercase tracking-[0.25em] font-medium transition-colors"
              >
                购买包年版 Buy Annual →
              </button>
            </div>

            {/* 终身版 */}
            <div className="relative p-8 bg-[#0C0C0F]">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#B89768] mb-2">Lifetime · 终身版</div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="font-serif text-5xl text-[#F4F1EA]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{lifetimePlan.price}</span>
                <span className="text-[11px] text-[#F4F1EA]/40">/ 一次 · 永久</span>
              </div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-[#F4F1EA]/50 mb-6">For loyal souls.</div>
              <ul className="space-y-2.5 text-sm text-[#F4F1EA]/85">
                {[
                  'Pro 版所有功能',
                  '永久有效，无年付',
                  '后续新功能优先使用',
                  '专属激活码（一码绑定一台设备）',
                  '海报壁纸打包（每月一次）',
                  '署名感谢（可选）',
                ].map((t, i) => (
                  <li key={i} className="flex items-start gap-2"><CheckCircle size={12} className="text-[#B89768] flex-shrink-0 mt-1" /> {t}</li>
                ))}
              </ul>
              <button
                onClick={() => setCheckoutPlan(lifetimePlan)}
                className="mt-8 w-full inline-flex items-center justify-center gap-2 px-4 py-3 border border-[#B89768] text-[#B89768] hover:bg-[#B89768] hover:text-[#0C0C0F] text-[11px] uppercase tracking-[0.25em] font-medium transition-colors"
              >
                购买终身 Buy Lifetime →
              </button>
            </div>
          </div>

          <p className="text-center text-[10px] uppercase tracking-[0.2em] text-[#F4F1EA]/35 mb-6">
            也可按月订阅：标准版 {PLAN_BY_ID.standard.price}/月 · Pro 版 {PLAN_BY_ID.pro.price}/月 · 新人 {PLAN_BY_ID.promo.price}/月
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-[10px] uppercase tracking-[0.2em] text-[#F4F1EA]/45">
            <span>付款方式：支付宝扫码（微信可加作者微信）</span>
            <span className="hidden sm:inline">·</span>
            <span>扫码后联系作者领取激活码</span>
            <span className="hidden sm:inline">·</span>
            <span>一个激活码绑定一台设备</span>
          </div>
        </div>
      </section>

      {/* ============ 订阅 SUBSCRIBE（新增，放在所有内容最底部） ============ */}
      <section id="subscribe" className="relative py-28 bg-[#0C0C0F] overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#B89768]/30 to-transparent" />
        {/* 背景光斑 */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#B89768]/6 blur-[160px] pointer-events-none" />

        <div className="relative max-w-2xl mx-auto px-6 text-center">

          {!subscribed ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-6">
                <Mail size={14} className="text-[#B89768]" />
                <span className="text-[10px] uppercase tracking-[0.4em] text-[#B89768]">订阅 · Subscribe</span>
              </div>
              <h2 className="font-serif text-4xl md:text-5xl text-[#F4F1EA] leading-tight mb-4" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                让信差带着剧本上门
              </h2>
              <p className="text-[#F4F1EA]/50 text-sm leading-relaxed mb-10" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                A letter from the workshop — new formats, storyboard tricks, occasional film essays.
                不发广告 · No spam · Unsubscribe anytime.
              </p>

              <form onSubmit={handleSubscribe} className="flex items-stretch gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@studio.com"
                  className="flex-1 px-5 py-3.5 bg-transparent border border-[#B89768]/40 focus:border-[#B89768] text-[#F4F1EA] placeholder-[#F4F1EA]/35 text-sm tracking-wide outline-none transition-colors"
                />
                <button
                  type="submit"
                  className="px-7 py-3.5 text-[11px] uppercase tracking-[0.25em] font-medium text-[#0C0C0F] bg-[#B89768] hover:bg-[#D4B483] border border-[#B89768] transition-all"
                >
                  订阅 Subscribe
                </button>
              </form>

              <div className="mt-10">
                <div className="text-[10px] uppercase tracking-[0.25em] text-[#F4F1EA]/35 mb-5">或者 · Or · 直接写信给我</div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-10">
                  <a href="mailto:1570046366@qq.com" className="group flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[#F4F1EA]/40">大陆</span>
                    <span className="text-sm text-[#B89768] group-hover:text-[#D4B483] border-b border-[#B89768]/30 group-hover:border-[#D4B483] pb-0.5 transition-colors">1570046366@qq.com</span>
                  </a>
                  <a href="mailto:kisenseisoku@gmail.com" className="group flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[#F4F1EA]/40">海外</span>
                    <span className="text-sm text-[#B89768] group-hover:text-[#D4B483] border-b border-[#B89768]/30 group-hover:border-[#D4B483] pb-0.5 transition-colors">kisenseisoku@gmail.com</span>
                  </a>
                </div>
              </div>
            </>
          ) : (
            <div className="animate-[fadeIn_0.6s_ease-out]">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full border border-[#B89768]/40 flex items-center justify-center">
                <CheckCircle size={24} className="text-[#B89768]" />
              </div>
              <h2 className="font-serif text-3xl md:text-4xl text-[#F4F1EA] leading-tight mb-3" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                信已经寄出了
              </h2>
              <p className="text-[#F4F1EA]/60 leading-relaxed max-w-sm mx-auto" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                Welcome. The first letter is on its way.
                每周一封，不长，关于编剧、电影、工具。
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="relative bg-[#08080A] text-[#F4F1EA]/40 py-14">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#B89768]/20 to-transparent" />
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-sm border border-[#B89768]/40 bg-[#B89768]/10 flex items-center justify-center">
                  <Film size={14} className="text-[#B89768]" />
                </div>
                <span className="font-serif text-xl text-[#F4F1EA]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                  <span className="font-medium">幕</span><span className="italic font-normal text-[#B89768]">后</span>
                </span>
              </div>
              <p className="text-sm leading-relaxed max-w-sm">
                电影美学编剧工作台 · A cinematic workbench for writers and directors.
                Built by KisenSeisoku with love for film, typography, and the quiet art of telling stories.
              </p>
            </div>
            {[
              { zh: '工坊', en: 'Atelier', links: ['剧本编辑器 Script Editor', '分镜工作台 Storyboard', '剧本架 Shelf', '壁纸墙 Art Wallpapers'] },
              { zh: '格式', en: 'Formats', links: ['好莱坞 Hollywood', 'Netflix', 'BBC', '中国广电 NRTA', 'Fountain'] },
            ].map(col => (
              <div key={col.zh}>
                <div className="text-[10px] uppercase tracking-[0.3em] text-[#B89768] mb-4">{col.zh} · {col.en}</div>
                <ul className="space-y-2">
                  {col.links.map(l => (
                    <li key={l} className="text-sm hover:text-[#F4F1EA] cursor-pointer transition-colors">{l}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="pt-8 border-t border-[#B89768]/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] uppercase tracking-[0.3em]">
            <div>© 2025 KisenSeisoku · 保留所有权利 · All frames reserved</div>
            <div className="flex items-center gap-2">
              <span>Made with</span>
              <Heart size={10} className="text-[#B89768] inline" />
              <span>for cinema · 为电影</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ============ 视频 Modal ============ */}
      {showVideoModal && (
        <div
          className="fixed inset-0 z-50 bg-[#0C0C0F]/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8 animate-[fadeIn_0.4s_ease-out]"
          onClick={() => setShowVideoModal(false)}
        >
          <button
            onClick={() => setShowVideoModal(false)}
            className="absolute top-6 right-6 w-10 h-10 text-[#F4F1EA]/70 hover:text-[#B89768] transition-colors"
          >
            <X size={20} />
          </button>
          <div className="w-full max-w-4xl bg-black overflow-hidden border border-[#B89768]/20" onClick={e => e.stopPropagation()}>
            <video
              controls autoPlay playsInline preload="metadata"
              poster="/films/tears-of-steel.jpg"
              className="w-full aspect-video object-cover bg-black block"
              src="/films/tears-of-steel.mp4"
            />
            <div className="px-4 py-2.5 text-[10px] uppercase tracking-[0.22em] text-[#F4F1EA]/40 border-t border-[#B89768]/15 bg-[#0C0C0F]">
              Tears of Steel · Blender Foundation · CC BY 3.0
            </div>
          </div>
        </div>
      )}

      {/* ============ 收款 / 付款 Modal ============ */}
      {checkoutPlan && (
        <CheckoutModal
          plan={checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          onBack={() => setCheckoutPlan(null)}
        />
      )}

      {/* Keyframes */}
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  )
}
