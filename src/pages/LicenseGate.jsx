﻿﻿import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Sparkles, Film, Pen, Shield, Check, X, KeyRound } from 'lucide-react'
import { useLicense } from '../utils/LicenseContext.jsx'
import { isAdmin } from '../utils/license.js'
import { getDeviceLabel } from '../utils/device.js'
import { usePageSeo } from '../utils/seo.js'

const FEATURES = [
  { icon: Film, title: '6 套行业格式', desc: '好莱坞 · Netflix · BBC · 中国广电 · Fountain · 自由格式' },
  { icon: Pen, title: '专业剧本编辑器', desc: '实时校验 · 角色提取 · 智能元素识别' },
  { icon: Film, title: '电影级分镜', desc: '美式横向 · 日式竖向 · 中式动画 · 表格视图' },
  { icon: Shield, title: '多格式导出', desc: 'PDF · Fountain · DOCX · HTML 一键交付' },
  { icon: Sparkles, title: 'AI 辅助', desc: '拼写 · 格式 · 1页 ≈ 1分钟 页面计时' },
  { icon: Check, title: '剧本架', desc: '海报封面 · 类型分类 · 作品导入 · 排版展示' },
]

export default function LicenseGate({ inline = false }) {
  const { activate } = useLicense()
  const navigate = useNavigate()
  usePageSeo({ title: '激活 · 幕后 文字剧场', noindex: true })

  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [adminPwd, setAdminPwd] = useState('')

  const handleActivate = () => {
    setError('')
    setSuccessMsg('')
    setLoading(true)
    setTimeout(() => {
      const result = activate(code)
      if (result.valid) {
        setSuccessMsg(`✓ 激活成功 · ${result.plan === 'test' ? '🧪 测试版' : result.plan === 'lifetime' ? '终身版' : result.plan === 'pro' ? 'Pro 版' : result.plan === 'trial' ? '试用版' : '免费版'} 已解锁`)
        setLoading(false)
        setTimeout(() => navigate('/studio'), 1200)
      } else {
        setError(result.reason)
        setLoading(false)
      }
    }, 500)
  }

  const handleAdminLogin = () => {
    if (isAdmin(adminPwd)) navigate('/admin')
    else alert('管理员密码错误')
  }

  // ============= 作为守卫组件的内联模式 =============
  if (inline) {
    return (
      <div className="min-h-screen noir-surface flex items-center justify-center p-6">
        <div className="relative z-10 max-w-md w-full animate-fade-in">
          <div className="text-center mb-8">
            <div className="headline-display text-7xl text-gold-gradient tracking-tighter mb-4">幕后</div>
            <div className="text-[10px] uppercase tracking-[0.4em] text-ivory-400">文字剧场</div>
            <div className="hairline my-8" />
            <div className="text-[11px] uppercase tracking-[0.25em] text-ivory-300">请输入激活码</div>
          </div>

          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleActivate()}
            placeholder="SF-XXXXX-XXXX-XXXXXX"
            className="input-noir text-center tracking-[0.3em] font-mono text-sm uppercase"
            maxLength={20}
          />
          <div className="mt-3 text-center text-[10px] tracking-[0.15em] text-ivory-500">
            本机设备 <span className="font-mono text-ivory-300">{getDeviceLabel()}</span> · 每个激活码只能绑定一台设备
          </div>

          {error && (
            <div className="mt-6 text-center text-[11px] uppercase tracking-[0.2em] text-red-400">
              — {error} —
            </div>
          )}
          {successMsg && (
            <div className="mt-6 text-center text-[11px] uppercase tracking-[0.2em] text-gold-500">
              — {successMsg} —
            </div>
          )}

          <button
            onClick={handleActivate}
            disabled={loading || !code}
            className="w-full mt-8 btn-gold justify-center disabled:opacity-40"
          >
            {loading ? '验证中...' : '激活进入'}
          </button>

          <div className="mt-10 text-center">
            <button
              onClick={() => setAdminOpen(!adminOpen)}
              className="text-[10px] uppercase tracking-[0.2em] text-ivory-400 hover:text-gold-500 transition-colors"
            >
              管理后台
            </button>
            {adminOpen && (
              <div className="mt-4 max-w-[240px] mx-auto">
                <input
                  type="password"
                  value={adminPwd}
                  onChange={e => setAdminPwd(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                  placeholder="管理员密码"
                  className="input-noir text-center text-sm"
                />
                <button
                  onClick={handleAdminLogin}
                  className="w-full mt-3 btn-outline justify-center py-2 text-[10px]"
                >
                  进入后台
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ============= 完整的品牌落地页 =============
  return (
    <div className="min-h-screen noir-surface flex items-center justify-center p-6 relative overflow-hidden">
      {/* 氛围光斑 */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-gold-500/5 rounded-full blur-[120px] animate-slow-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-ink-500/10 rounded-full blur-[100px] animate-slow-pulse" />

      <div className="relative z-10 max-w-6xl w-full grid lg:grid-cols-2 gap-16 items-center animate-fade-in">

        {/* ============ 左：品牌陈述 ============ */}
        <div>
          <div className="text-[10px] uppercase tracking-[0.5em] text-gold-500 mb-6">A Film Noir Workbench</div>
          <h1 className="headline-display text-[clamp(3rem,7vw,6rem)] leading-[0.95] text-ivory-100 mb-4">
            幕<span className="text-gold-gradient">后</span>
          </h1>
          <div className="headline text-2xl md:text-3xl text-ivory-200 mb-8 tracking-luxury">
            文字剧场 · 电影美学工作台
          </div>

          <p className="text-sm text-ivory-300 leading-relaxed max-w-md mb-12">
            一个为编剧、导演、分镜师设计的创作空间。<br/>
            在这里，文字被排版成剧本，画面被定格成分镜，<br/>
            灵感被收进剧本架 —— 全部由你掌控。
          </p>

          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            {FEATURES.map(f => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="w-6 h-6 flex items-center justify-center border border-gold-500/30 text-gold-500 text-[10px] flex-shrink-0 mt-0.5">
                  <f.icon size={12} />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.15em] text-ivory-200">{f.title}</div>
                  <div className="text-[11px] text-ivory-400 mt-0.5 leading-relaxed">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ============ 右：激活卡 ============ */}
        <div className="card-noir p-10">
          <div className="text-center mb-10">
            <div className="text-[10px] uppercase tracking-[0.4em] text-gold-500 mb-3">— Activation —</div>
            <div className="headline text-3xl text-ivory-100 tracking-luxury">进入剧场</div>
          </div>

          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleActivate()}
            placeholder="SF-XXXXX-XXXX-XXXXXX"
            className="input-noir text-center tracking-[0.3em] font-mono text-sm uppercase"
            maxLength={20}
          />
          <div className="mt-3 text-center text-[10px] tracking-[0.15em] text-ivory-500">
            本机设备 <span className="font-mono text-ivory-300">{getDeviceLabel()}</span> · 每个激活码只能绑定一台设备
          </div>

          {error && (
            <div className="mt-6 text-center text-[10px] uppercase tracking-[0.25em] text-red-400">
              — {error} —
            </div>
          )}
          {successMsg && (
            <div className="mt-6 text-center text-[10px] uppercase tracking-[0.25em] text-gold-500">
              — {successMsg} —
            </div>
          )}

          <button
            onClick={handleActivate}
            disabled={loading || !code}
            className="w-full mt-10 btn-gold justify-center disabled:opacity-40"
          >
            {loading ? '验证中...' : '激活并开始创作'}
          </button>

          <div className="mt-8 text-center">
            <button
              onClick={() => setAdminOpen(!adminOpen)}
              className="text-[10px] uppercase tracking-[0.25em] text-ivory-400 hover:text-gold-500 transition-colors"
            >
              管理后台
            </button>
            {adminOpen && (
              <div className="mt-4 max-w-[240px] mx-auto">
                <input
                  type="password"
                  value={adminPwd}
                  onChange={e => setAdminPwd(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                  placeholder="管理员密码"
                  className="input-noir text-center text-sm"
                />
                <button
                  onClick={handleAdminLogin}
                  className="w-full mt-3 btn-outline justify-center py-2 text-[10px]"
                >
                  进入后台
                </button>
              </div>
            )}
          </div>

          {/* 底部细线 */}
          <div className="hairline mt-10" />
          <div className="mt-6 text-center text-[9px] uppercase tracking-[0.3em] text-ivory-400 opacity-60">
            KisenSeisoku · All Rights Reserved
          </div>
        </div>
      </div>
    </div>
  )
}
