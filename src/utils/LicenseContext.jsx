// LicenseProvider - React Context 管理全局激活状态
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { validateLicenseCode, saveLicense, clearLicense, loadLicense } from './license.js'

const LicenseContext = createContext(null)

const LICENSE_STORAGE_KEY = 'scriptforge_license'

export function LicenseProvider({ children }) {
  const [license, setLicense] = useState(() => loadLicense())

  // 跨标签页同步
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === LICENSE_STORAGE_KEY) {
        if (!e.newValue) {
          setLicense(null)
        } else {
          try { setLicense(JSON.parse(e.newValue)) } catch { setLicense(null) }
        }
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // 激活
  const activate = useCallback((input) => {
    const result = validateLicenseCode(input)
    if (result.valid) {
      saveLicense(result)
      setLicense(result)
    }
    return result
  }, [])

  // 退出
  const deactivate = useCallback(() => {
    clearLicense()
    setLicense(null)
  }, [])

  const value = {
    license,
    plan: license?.plan || 'free',      // free | trial | pro | lifetime | test
    role: license?.role || 'user',
    isFree: license == null || license.plan === 'free',
    isTrial: license?.plan === 'trial',
    isPro: license?.plan === 'pro',      // 仅 pro 年卡
    isLifetime: license?.plan === 'lifetime',
    isTest: license?.plan === 'test',    // ⭐ 通用测试版
    // 测试版 / Pro / 终身 视为全功能，都能解锁付费特性
    isPaid: license != null && (license.plan === 'test' || license.plan !== 'free'),
    activate,
    deactivate,
  }

  return (
    <LicenseContext.Provider value={value}>
      {children}
    </LicenseContext.Provider>
  )
}

// Hook
export function useLicense() {
  const ctx = useContext(LicenseContext)
  if (!ctx) throw new Error('useLicense 必须在 LicenseProvider 内使用')
  return ctx
}
