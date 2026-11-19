import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { LicenseProvider, useLicense } from './utils/LicenseContext.jsx'
import Layout from './components/Layout.jsx'
import Homepage from './pages/Homepage.jsx'
import LicenseGate from './pages/LicenseGate.jsx'
import AdminPanel from './pages/AdminPanel.jsx'

function RequireLicense({ children }) {
  const { license } = useLicense()
  if (!license) return <LicenseGate inline />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Homepage />} />
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="/license" element={<LicenseGate />} />
      <Route path="/admin" element={<AdminPanel />} />
      <Route path="/studio/*" element={
        <RequireLicense>
          <Layout />
        </RequireLicense>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <LicenseProvider>
      <AppRoutes />
    </LicenseProvider>
  )
}
