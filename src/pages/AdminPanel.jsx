import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Key, Copy, Plus, Trash2, Calendar, Tag, Users, Download, Upload } from 'lucide-react'
import {
  generateLicenseCode, getIssuedCodes, deleteIssuedCode, ADMIN_PASSWORD,
  exportIssuedCodes, importIssuedCodes,
} from '../utils/license.js'
import { usePageSeo } from '../utils/seo.js'

export default function AdminPanel() {
  const navigate = useNavigate()
  usePageSeo({ title: '管理后台 · 幕后', noindex: true })
  const [authorized, setAuthorized] = useState(false)
  const [password, setPassword] = useState('')
  const [codes, setCodes] = useState(getIssuedCodes())
  const [newCodes, setNewCodes] = useState([])

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthorized(true)
      setCodes(getIssuedCodes())
    } else {
      alert('密码错误')
    }
  }

  const handleGenerate = (plan = 'pro', days = 365) => {
    const result = generateLicenseCode(plan, days)
    setNewCodes([result, ...newCodes])
    setCodes(getIssuedCodes())
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
  }

  const deleteCode = (code) => {
    if (!confirm(`确定删除激活码 ${code} 吗？`)) return
    deleteIssuedCode(code)
    setCodes(getIssuedCodes())
  }

  const handleExport = () => {
    const blob = new Blob([exportIssuedCodes()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scriptforge-codes-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const r = importIssuedCodes(String(reader.result))
      alert(r.ok ? `导入完成，新增 ${r.added} 条（已存在的自动跳过）` : '文件格式不正确')
      setCodes(getIssuedCodes())
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-noir-900 p-4">
        <div className="card-noir p-8 w-full max-w-md">
          <h1 className="headline text-3xl text-gold-gradient mb-6 flex items-center gap-2">
            <Key size={24} className="text-gold-500" />
            管理员登录
          </h1>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="输入管理员密码"
            className="input-noir mb-4"
          />
          <button
            onClick={handleLogin}
            className="w-full btn-gold justify-center font-semibold"
          >
            登录
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full mt-3 py-2 text-ivory-400 hover:text-gold-500 text-[11px] uppercase tracking-[0.15em]"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-noir-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-8 border-b border-noir-700 pb-4">
          <div>
            <h1 className="headline text-3xl text-gold-gradient flex items-center gap-2">
              <Key className="text-gold-500" />
              管理后台
            </h1>
            <p className="text-[11px] uppercase tracking-[0.25em] text-gold-500 mt-2">
              LICENSE · KEY · ADMINISTRATION
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="btn-outline"
          >
            返回首页
          </button>
        </div>

        {/* 生成面板 */}
        <div className="card-noir p-6 mb-8">
          <h2 className="text-lg text-ivory-100 mb-4 flex items-center gap-2">
            <Plus size={20} className="text-gold-500" />
            生成新激活码
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleGenerate('trial', 7)}
              className="btn-outline"
            >
              <Calendar size={14} />
              试用码 (7天)
            </button>
            <button
              onClick={() => handleGenerate('pro', 365)}
              className="btn-gold"
            >
              <Tag size={14} />
              Pro 年卡
            </button>
            <button
              onClick={() => handleGenerate('pro', 30)}
              className="btn-outline"
            >
              <Calendar size={14} />
              月度激活码
            </button>
            <button
              onClick={() => handleGenerate('lifetime', null)}
              className="px-4 py-2 border border-gold-500 bg-gold-500/10 text-gold-500 text-[11px] uppercase tracking-[0.15em]"
            >
              ⭐ 终身版
            </button>
            <button
              onClick={() => handleGenerate('pro', 180)}
              className="btn-outline"
            >
              6个月
            </button>
          </div>

          {/* 新生成的激活码展示 */}
          {newCodes.length > 0 && (
            <div className="mt-6 p-4 border border-gold-500/30 bg-noir-800">
              <h3 className="text-sm text-gold-500 mb-3 text-[11px] uppercase tracking-[0.2em]">✨ 新生成的激活码</h3>
              <div className="space-y-2">
                {newCodes.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-noir-900 p-3 border border-noir-700">
                    <code className="font-mono text-lg tracking-wider flex-1 text-ivory-100">{item.code}</code>
                    <span className={`lock-chip ${
                      item.plan === 'lifetime' ? 'text-gold-500' :
                      item.plan === 'pro' ? 'text-gold-400' :
                      'text-ivory-400'
                    }`}>
                      {item.plan === 'lifetime' ? '终身' : item.plan === 'pro' ? 'Pro' : '试用'}
                    </span>
                    <button
                      onClick={() => copyToClipboard(item.code)}
                      className="p-2 text-ivory-400 hover:text-gold-500"
                      title="复制"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 已签发列表 */}
        <div className="card-noir p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg text-ivory-100 flex items-center gap-2">
              <Users size={20} className="text-gold-500" />
              已签发激活码 ({codes.length})
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={handleExport} className="btn-outline !px-3 !py-1.5 !text-[10px]">
                <Download size={12} />
                导出台账
              </button>
              <label className="btn-outline !px-3 !py-1.5 !text-[10px] cursor-pointer">
                <Upload size={12} />
                导入台账
                <input type="file" accept="application/json,.json" onChange={handleImport} className="hidden" />
              </label>
            </div>
          </div>

          <p className="text-[11px] text-ivory-400 leading-relaxed mb-4 border-l-2 border-gold-500/40 pl-3">
            激活码本身带签名，验证时不需要查这张表，所以把码发到别人的手机、另一台电脑也能激活。
            这张表只是本机台账（浏览器本地存储），换设备会是空的 —— 用「导出台账 / 导入台账」把它搬过去即可。
          </p>

          {codes.length === 0 ? (
            <p className="text-ivory-400 text-center py-8">暂无激活码记录</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-ivory-200">
                <thead>
                  <tr className="border-b border-noir-700 text-left">
                    <th className="py-2 pr-4 text-[10px] uppercase tracking-[0.15em] text-gold-500">激活码</th>
                    <th className="py-2 pr-4 text-[10px] uppercase tracking-[0.15em] text-gold-500">类型</th>
                    <th className="py-2 pr-4 text-[10px] uppercase tracking-[0.15em] text-gold-500">过期时间</th>
                    <th className="py-2 pr-4 text-[10px] uppercase tracking-[0.15em] text-gold-500">创建时间</th>
                    <th className="py-2 pr-4 text-[10px] uppercase tracking-[0.15em] text-gold-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map(item => (
                    <tr key={item.code} className="border-b border-noir-700 hover:border-gold-500/30">
                      <td className="py-3 pr-4 font-mono">{item.code}</td>
                      <td className="py-3 pr-4">
                        <span className={`lock-chip ${
                          item.role === 'admin' ? 'text-red-400' :
                          item.plan === 'lifetime' ? 'text-gold-500' :
                          item.plan === 'pro' ? 'text-gold-400' :
                          'text-ivory-400'
                        }`}>
                          {item.role === 'admin' ? '管理员' : item.plan === 'lifetime' ? '终身' : item.plan === 'pro' ? 'Pro' : '试用'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-ivory-400">
                        {item.expires ? new Date(item.expires).toLocaleDateString('zh-CN') : '永不过期'}
                      </td>
                      <td className="py-3 pr-4 text-ivory-400">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('zh-CN') : '-'}
                      </td>
                      <td className="py-3 pr-4">
                        {item.role !== 'admin' && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => copyToClipboard(item.code)}
                              className="p-1 hover:bg-gold-500/20 text-gold-500"
                            >
                              <Copy size={14} />
                            </button>
                            <button
                              onClick={() => deleteCode(item.code)}
                              className="p-1 hover:bg-red-500/20 text-red-400"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 使用说明 */}
        <div className="mt-8 card-noir p-6 border border-gold-500/15">
          <h2 className="font-semibold text-gold-500 mb-2 text-[11px] uppercase tracking-[0.2em]">💡 使用说明</h2>
          <ul className="text-sm text-ivory-200 space-y-1">
            <li>• 激活码格式为 <code className="bg-noir-700 px-1 border border-noir-600">SF-XXXXX-XXXX-XXXXXX</code></li>
            <li>• 码里写入了类型、到期日和签名，验证完全在本地完成 —— 换手机、换浏览器、换电脑都能用</li>
            <li>• 本页的「已签发」列表只是本机台账，不会跟着账号走；需要迁移就导出 JSON 再导入</li>
            <li>• 旧版生成的随机码没有签名，只在那台生成它的浏览器里有效，建议重新生成一次</li>
            <li>• 过期的激活码用户自动失去 Pro 权限</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
