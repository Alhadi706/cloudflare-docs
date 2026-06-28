'use client'

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ADMIN CONTROL CENTER - COMPREHENSIVE SYSTEM MANAGEMENT
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Features:
 *   1. System Setup Wizard (Bootstrap)
 *   2. Departments & Managers Management
 *   3. Roles & Permissions System
 *   4. Employee Assignment
 *   5. Bot Integration (Telegram + WhatsApp) - PRIORITY
 *   6. System Settings
 *   7. Audit Log Viewer
 *   8. Real-time Status Monitoring
 */

import React, { useState, useEffect } from 'react'
import AdminBootstrapWizard from '@/components/auth/AdminBootstrapWizard'
import { getClientTenantHeaders } from '@/lib/getClientTenantId'
import { 
  Users, 
  Shield, 
  Bot, 
  Settings, 
  FileText, 
  Activity,
  Building2,
  Send,
  MessageCircle,
  Check,
  X,
  AlertCircle,
  Plus,
  Edit2, 
  Trash2,
  RefreshCw,
  Wrench
} from 'lucide-react'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Department {
  id: number
  department_name: string
  department_name_ar: string | null
  description: string | null
  manager_id: string | null
  is_active: boolean
  employee_count: number
  created_at: string
}

interface UserRole {
  id: number
  user_id: string
  email: string | null
  role: 'super_admin' | 'admin' | 'manager' | 'employee' | 'viewer'
  department_id: number | null
  department_name: string | null
  department_name_ar: string | null
  is_active: boolean
  assigned_at: string
}

interface BotStatus {
  id: number
  bot_type: 'telegram' | 'whatsapp'
  bot_name: string | null
  is_active: boolean
  status: 'active' | 'inactive' | 'error' | 'connecting'
  last_ping: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

interface SystemSetting {
  setting_key: string
  setting_value: Record<string, any>
  description: string | null
  updated_at: string
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function AdminControlCenter() {
  const needsBootstrap = typeof window !== 'undefined' && !!localStorage.getItem('needs_bootstrap');
  const [activeTab, setActiveTab] = useState<'setup' | 'departments' | 'users' | 'bots' | 'settings' | 'audit'>(
    needsBootstrap ? 'setup' : 'bots'
  )
  
  // State
  const [departments, setDepartments] = useState<Department[]>([])
  const [userRoles, setUserRoles] = useState<UserRole[]>([])
  const [botStatus, setBotStatus] = useState<BotStatus[]>([])
  const [systemSettings, setSystemSettings] = useState<SystemSetting[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  
  // Loading states
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DATA FETCHING
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const API_BASE = '/api/admin-control'  // Fixed: removed /api prefix

  const fetchDepartments = async () => {
    try {
      const response = await fetch(`${API_BASE}/departments`, { headers: { ...getClientTenantHeaders() } })
      if (!response.ok) throw new Error('Failed to fetch departments')
      const data = await response.json()
      if (data.success) {
        setDepartments(data.departments)
      }
    } catch (err: any) {
      console.error('Error fetching departments:', err)
      setError(err.message)
    }
  }

  const fetchUserRoles = async () => {
    try {
      const response = await fetch(`${API_BASE}/users/roles`, { headers: { ...getClientTenantHeaders() } })
      if (!response.ok) throw new Error('Failed to fetch user roles')
      const data = await response.json()
      if (data.success) {
        setUserRoles(data.users)
      }
    } catch (err: any) {
      console.error('Error fetching user roles:', err)
      setError(err.message)
    }
  }

  const fetchBotStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/bots/status`, { headers: { ...getClientTenantHeaders() } })
      if (!response.ok) throw new Error('Failed to fetch bot status')
      const data = await response.json()
      if (data.success) {
        setBotStatus(data.bots)
      }
    } catch (err: any) {
      console.error('Error fetching bot status:', err)
      setError(err.message)
    }
  }

  const fetchSystemSettings = async () => {
    try {
      const response = await fetch(`${API_BASE}/settings`, { headers: { ...getClientTenantHeaders() } })
      if (!response.ok) throw new Error('Failed to fetch settings')
      const data = await response.json()
      if (data.success) {
        setSystemSettings(data.settings)
      }
    } catch (err: any) {
      console.error('Error fetching settings:', err)
      setError(err.message)
    }
  }

  const fetchAuditLogs = async () => {
    try {
      const response = await fetch(`${API_BASE}/audit-log?limit=50`, { headers: { ...getClientTenantHeaders() } })
      if (!response.ok) throw new Error('Failed to fetch audit logs')
      const data = await response.json()
      if (data.success) {
        setAuditLogs(data.logs)
      }
    } catch (err: any) {
      console.error('Error fetching audit logs:', err)
      setError(err.message)
    }
  }

  // Auto-hide messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000)
      return () => clearTimeout(timer)
    }
  }, [error])

  // Initial data load
  useEffect(() => {
    fetchDepartments()
    fetchUserRoles()
    fetchBotStatus()
    fetchSystemSettings()
    fetchAuditLogs()
  }, [])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BOT INTEGRATION HANDLERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const [telegramToken, setTelegramToken] = useState('')
  const [whatsappApiKey, setWhatsappApiKey] = useState('')
  const [whatsappPhoneId, setWhatsappPhoneId] = useState('')
  const [botLoading, setBotLoading] = useState<string | null>(null)

  const handleConnectTelegram = async () => {
    if (!telegramToken.trim()) {
      setError('Please enter a valid Telegram bot token')
      return
    }

    setBotLoading('telegram')
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch(`${API_BASE}/bots/telegram/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'admin'
        },
        body: JSON.stringify({
          bot_type: 'telegram',
          bot_token: telegramToken.trim()
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to connect Telegram bot')
      }

      if (data.success) {
        setSuccessMessage(data.message)
        setTelegramToken('') // Clear input
        await fetchBotStatus() // Refresh bot status
      } else {
        throw new Error('Unexpected response from server')
      }
    } catch (err: any) {
      console.error('Error connecting Telegram bot:', err)
      setError(err.message)
    } finally {
      setBotLoading(null)
    }
  }

  const handleConnectWhatsApp = async () => {
    if (!whatsappApiKey.trim() || !whatsappPhoneId.trim()) {
      setError('Please enter both WhatsApp API Key and Phone Number ID')
      return
    }

    setBotLoading('whatsapp')
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch(`${API_BASE}/bots/whatsapp/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'admin'
        },
        body: JSON.stringify({
          bot_type: 'whatsapp',
          api_key: whatsappApiKey.trim(),
          phone_number_id: whatsappPhoneId.trim()
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to connect WhatsApp bot')
      }

      if (data.success) {
        setSuccessMessage(data.message)
        setWhatsappApiKey('') // Clear inputs
        setWhatsappPhoneId('')
        await fetchBotStatus() // Refresh bot status
      } else {
        throw new Error('Unexpected response from server')
      }
    } catch (err: any) {
      console.error('Error connecting WhatsApp bot:', err)
      setError(err.message)
    } finally {
      setBotLoading(null)
    }
  }

  const handleDisconnectBot = async (botType: 'telegram' | 'whatsapp') => {
    setBotLoading(botType)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch(`${API_BASE}/bots/${botType}/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'admin'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || `Failed to disconnect ${botType} bot`)
      }

      if (data.success) {
        setSuccessMessage(data.message)
        await fetchBotStatus() // Refresh bot status
      }
    } catch (err: any) {
      console.error(`Error disconnecting ${botType} bot:`, err)
      setError(err.message)
    } finally {
      setBotLoading(null)
    }
  }

  const handleTestConnection = async (botType: 'telegram' | 'whatsapp') => {
    setBotLoading(botType)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch(`${API_BASE}/bots/${botType}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'admin'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || `Failed to test ${botType} bot connection`)
      }

      if (data.success) {
        setSuccessMessage(data.message)
      } else {
        throw new Error('Unexpected response from server')
      }
    } catch (err: any) {
      console.error(`Error testing ${botType} bot:`, err)
      setError(err.message)
    } finally {
      setBotLoading(null)
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER HELPERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Check className="w-4 h-4 text-green-500" />
      case 'inactive':
        return <X className="w-4 h-4 text-gray-400" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'connecting':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800 border-green-300',
      inactive: 'bg-gray-100 text-gray-600 border-gray-300',
      error: 'bg-red-100 text-red-800 border-red-300',
      connecting: 'bg-blue-100 text-blue-800 border-blue-300'
    }[status] || 'bg-gray-100 text-gray-600 border-gray-300'

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${styles} flex items-center gap-1`}>
        {getStatusIcon(status)}
        {status === 'active' ? 'متصل' : status === 'inactive' ? 'غير متصل' : status === 'error' ? 'خطأ' : 'جاري الاتصال'}
      </span>
    )
  }

  const getRoleBadge = (role: string) => {
    const styles = {
      super_admin: 'bg-purple-100 text-purple-800 border-purple-300',
      admin: 'bg-blue-100 text-blue-800 border-blue-300',
      manager: 'bg-green-100 text-green-800 border-green-300',
      employee: 'bg-gray-100 text-gray-600 border-gray-300',
      viewer: 'bg-yellow-100 text-yellow-800 border-yellow-300'
    }[role] || 'bg-gray-100 text-gray-600 border-gray-300'

    const labels = {
      super_admin: 'مدير رئيسي',
      admin: 'مدير',
      manager: 'مدير قسم',
      employee: 'موظف',
      viewer: 'مشاهد'
    }

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${styles}`}>
        {labels[role as keyof typeof labels] || role}
      </span>
    )
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Shield className="w-10 h-10 text-blue-600" />
            مركز التحكم الإداري
          </h1>
          <p className="text-gray-600">إدارة شاملة للنظام - الأقسام، الأدوار، البوتات، والإعدادات</p>
        </div>

        {/* Alert Messages */}
        {error && (
          <div key="error-msg" className="mb-6 bg-red-50 border-r-4 border-red-500 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-800">خطأ</h3>
              <p className="text-red-700 text-sm whitespace-pre-wrap">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="mr-auto text-red-500 hover:text-red-700">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {successMessage && (
          <div key="success-msg" className="mb-6 bg-green-50 border-r-4 border-green-500 p-4 rounded-lg flex items-start gap-3">
            <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-800">نجح</h3>
              <p className="text-green-700 text-sm whitespace-pre-wrap">{successMessage}</p>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="mr-auto text-green-500 hover:text-green-700">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="flex overflow-x-auto">
            {needsBootstrap && (
              <TabButton
                active={activeTab === 'setup'}
                onClick={() => setActiveTab('setup')}
                icon={<Wrench className="w-5 h-5" />}
                label="إعداد النظام"
                badge="جديد"
              />
            )}
            <TabButton
              active={activeTab === 'departments'}
              onClick={() => setActiveTab('departments')}
              icon={<Building2 className="w-5 h-5" />}
              label="الأقسام"
              count={departments.length}
            />
            <TabButton
              active={activeTab === 'users'}
              onClick={() => setActiveTab('users')}
              icon={<Users className="w-5 h-5" />}
              label="المستخدمين"
              count={userRoles.length}
            />
            <TabButton
              active={activeTab === 'bots'}
              onClick={() => setActiveTab('bots')}
              icon={<Bot className="w-5 h-5" />}
              label="ربط البوتات"
              count={botStatus.filter(b => b.is_active).length}
              badge="أولوية"
            />
            <TabButton
              active={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              icon={<Settings className="w-5 h-5" />}
              label="الإعدادات"
              count={systemSettings.length}
            />
            <TabButton
              active={activeTab === 'audit'}
              onClick={() => setActiveTab('audit')}
              icon={<FileText className="w-5 h-5" />}
              label="سجل الأنشطة"
              count={auditLogs.length}
            />
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {activeTab === 'setup' && (
            <div className="space-y-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Wrench className="w-6 h-6 text-blue-600" />
                  معالج إعداد النظام
                </h2>
                <p className="text-gray-600">اتبع الخطوات أدناه لإعداد المنظمة والأقسام والمديرين</p>
              </div>
              <AdminBootstrapWizard />
            </div>
          )}

          {activeTab === 'departments' && (
            <DepartmentsTab 
              departments={departments} 
              onRefresh={fetchDepartments} 
            />
          )}

          {activeTab === 'users' && (
            <UsersTab 
              users={userRoles} 
              departments={departments}
              onRefresh={fetchUserRoles} 
            />
          )}

          {activeTab === 'bots' && (
            <BotsTab
              botStatus={botStatus}
              telegramToken={telegramToken}
              setTelegramToken={setTelegramToken}
              whatsappApiKey={whatsappApiKey}
              setWhatsappApiKey={setWhatsappApiKey}
              whatsappPhoneId={whatsappPhoneId}
              setWhatsappPhoneId={setWhatsappPhoneId}
              onConnectTelegram={handleConnectTelegram}
              onConnectWhatsApp={handleConnectWhatsApp}
              onDisconnect={handleDisconnectBot}
              onTestConnection={handleTestConnection}
              botLoading={botLoading}
              getStatusBadge={getStatusBadge}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab 
              settings={systemSettings} 
              onRefresh={fetchSystemSettings} 
            />
          )}

          {activeTab === 'audit' && (
            <AuditTab 
              logs={auditLogs} 
              onRefresh={fetchAuditLogs} 
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB BUTTON COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface TabButtonProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  count?: number
  badge?: string
}

function TabButton({ active, onClick, icon, label, count, badge }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-all whitespace-nowrap ${
        active
          ? 'border-blue-600 text-blue-600 bg-blue-50'
          : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
      {count !== undefined && (
        <span className={`px-2 py-0.5 text-xs rounded-full ${
          active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
        }`}>
          {count}
        </span>
      )}
      {badge && (
        <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-800 rounded-full border border-orange-300 font-semibold">
          {badge}
        </span>
      )}
    </button>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DEPARTMENTS TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface DepartmentsTabProps {
  departments: Department[]
  onRefresh: () => void
}

function DepartmentsTab({ departments, onRefresh }: DepartmentsTabProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">إدارة الأقسام</h2>
        <div className="flex gap-2">
          <button 
            onClick={onRefresh}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            تحديث
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" />
            إضافة قسم جديد
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">القسم</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">الاسم بالعربية</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">عدد الموظفين</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">الحالة</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {departments.map((dept) => (
              <tr key={dept.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{dept.department_name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{dept.department_name_ar || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{dept.employee_count}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    dept.is_active 
                      ? 'bg-green-100 text-green-800 border border-green-300' 
                      : 'bg-gray-100 text-gray-600 border border-gray-300'
                  }`}>
                    {dept.is_active ? 'نشط' : 'غير نشط'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {departments.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Building2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>لا توجد أقسام مسجلة</p>
        </div>
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USERS TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface UsersTabProps {
  users: UserRole[]
  departments: Department[]
  onRefresh: () => void
}

function UsersTab({ users, departments, onRefresh }: UsersTabProps) {
  const getRoleBadge = (role: string) => {
    const styles = {
      super_admin: 'bg-purple-100 text-purple-800 border-purple-300',
      admin: 'bg-blue-100 text-blue-800 border-blue-300',
      manager: 'bg-green-100 text-green-800 border-green-300',
      employee: 'bg-gray-100 text-gray-600 border-gray-300',
      viewer: 'bg-yellow-100 text-yellow-800 border-yellow-300'
    }[role] || 'bg-gray-100 text-gray-600 border-gray-300'

    const labels = {
      super_admin: 'مدير رئيسي',
      admin: 'مدير',
      manager: 'مدير قسم',
      employee: 'موظف',
      viewer: 'مشاهد'
    }

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${styles}`}>
        {labels[role as keyof typeof labels] || role}
      </span>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">إدارة المستخدمين والأدوار</h2>
        <div className="flex gap-2">
          <button 
            onClick={onRefresh}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            تحديث
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" />
            إضافة دور
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">المستخدم</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">البريد</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">الدور</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">القسم</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">الحالة</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{user.user_id}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{user.email || '-'}</td>
                <td className="px-4 py-3">{getRoleBadge(user.role)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{user.department_name_ar || user.department_name || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    user.is_active 
                      ? 'bg-green-100 text-green-800 border border-green-300' 
                      : 'bg-gray-100 text-gray-600 border border-gray-300'
                  }`}>
                    {user.is_active ? 'نشط' : 'غير نشط'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>لا توجد أدوار مسجلة</p>
        </div>
      )}

      {/* ── دعوة مدير إدارة / قسم جديد ── */}
      <InviteManagerPanel onRefresh={onRefresh} />
    </div>
  )
}

// ── دعوة مدير إدارة — يستخدم /api/auth/invite مباشرة ────────────────────────

const DEPT_OPTIONS_LIST = [
  { code: 'HR',    label: 'الموارد البشرية' },
  { code: 'FIN',   label: 'المالية' },
  { code: 'GIS',   label: 'الجغرافيا والمشاريع' },
  { code: 'MAINT', label: 'الصيانة والبنية التحتية' },
  { code: 'PROC',  label: 'المشتريات' },
  { code: 'ASSET', label: 'الأصول' },
  { code: 'IT',    label: 'تقنية المعلومات' },
  { code: 'LEGAL', label: 'الشؤون القانونية' },
  { code: 'OPS',   label: 'العمليات' },
] as const;

const ROLE_OPTIONS_LIST = [
  { value: 'dept_manager',    label: 'مدير إدارة' },
  { value: 'section_manager', label: 'مدير قسم' },
  { value: 'supervisor',      label: 'مشرف' },
  { value: 'employee',        label: 'موظف' },
] as const;

function InviteManagerPanel({ onRefresh }: { onRefresh: () => void }) {
  const [open,        setOpen]        = React.useState(false);
  const [loading,     setLoading]     = React.useState(false);
  const [result,      setResult]      = React.useState<{ username: string; temp_password: string; full_name: string } | null>(null);
  const [inviteError, setInviteError] = React.useState('');
  const [form, setForm] = React.useState({
    full_name:       '',
    email:           '',
    role:            'dept_manager' as string,
    department_code: 'HR',
    job_title:       '',
  });
  const setF = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleInvite = async () => {
    if (!form.full_name || !form.email || !form.department_code) {
      setInviteError('الاسم والبريد والإدارة مطلوبة'); return;
    }
    setInviteError(''); setLoading(true);
    try {
      const token = localStorage.getItem('auth_token') ?? '';
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setInviteError(data.detail ?? 'فشل إنشاء الحساب'); return; }
      setResult({ username: data.username, temp_password: data.temp_password, full_name: form.full_name });
      setForm({ full_name: '', email: '', role: 'dept_manager', department_code: 'HR', job_title: '' });
      onRefresh();
    } catch {
      setInviteError('تعذّر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 border-t border-slate-200 pt-6" dir="rtl">
      <button
        onClick={() => { setOpen(v => !v); setResult(null); setInviteError(''); }}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-semibold"
      >
        <Plus className="w-4 h-4" />
        دعوة مدير / موظف جديد
      </button>

      {open && (
        <div className="mt-4 p-5 rounded-xl bg-slate-800 border border-slate-700 max-w-lg">
          <h3 className="text-sm font-bold text-white mb-4">إنشاء حساب جديد + بيانات دخول</h3>

          {inviteError && (
            <div className="mb-3 p-2.5 rounded-lg bg-red-900/30 border border-red-700/40 text-xs text-red-300">{inviteError}</div>
          )}

          {result && (
            <div className="mb-4 p-4 rounded-lg bg-emerald-900/30 border border-emerald-600/40">
              <p className="text-xs font-bold text-emerald-300 mb-2">✓ تم إنشاء حساب {result.full_name}</p>
              <div className="space-y-1 font-mono text-xs text-white">
                <div><span className="text-slate-400">اسم المستخدم: </span><span className="text-cyan-300 select-all">{result.username}</span></div>
                <div><span className="text-slate-400">كلمة المرور المؤقتة: </span><span className="text-amber-300 select-all">{result.temp_password}</span></div>
              </div>
              <p className="mt-2 text-[10px] text-slate-400">أرسل هذه البيانات للمستخدم — سيُطلب منه تغيير كلمة المرور عند أول دخول.</p>
            </div>
          )}

          <div className="space-y-3">
            <input type="text" placeholder="الاسم الكامل" value={form.full_name} onChange={e => setF('full_name')(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500" />
            <input type="email" placeholder="البريد الإلكتروني" value={form.email} onChange={e => setF('email')(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500" dir="ltr" />
            <input type="text" placeholder="المسمى الوظيفي (اختياري)" value={form.job_title} onChange={e => setF('job_title')(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500" />
            <div className="grid grid-cols-2 gap-2">
              <select value={form.department_code} onChange={e => setF('department_code')(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                {DEPT_OPTIONS_LIST.map(d => <option key={d.code} value={d.code}>{d.label}</option>)}
              </select>
              <select value={form.role} onChange={e => setF('role')(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                {ROLE_OPTIONS_LIST.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <button onClick={handleInvite} disabled={loading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {loading ? 'جارٍ الإنشاء…' : 'إنشاء الحساب وتوليد كلمة المرور'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BOTS TAB (PRIORITY)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface BotsTabProps {
  botStatus: BotStatus[]
  telegramToken: string
  setTelegramToken: (value: string) => void
  whatsappApiKey: string
  setWhatsappApiKey: (value: string) => void
  whatsappPhoneId: string
  setWhatsappPhoneId: (value: string) => void
  onConnectTelegram: () => void
  onConnectWhatsApp: () => void
  onDisconnect: (botType: 'telegram' | 'whatsapp') => void
  onTestConnection: (botType: 'telegram' | 'whatsapp') => void
  botLoading: string | null
  getStatusBadge: (status: string) => React.ReactNode
}

function BotsTab({
  botStatus,
  telegramToken,
  setTelegramToken,
  whatsappApiKey,
  setWhatsappApiKey,
  whatsappPhoneId,
  setWhatsappPhoneId,
  onConnectTelegram,
  onConnectWhatsApp,
  onDisconnect,
  onTestConnection,
  botLoading,
  getStatusBadge
}: BotsTabProps) {
  const telegramBot = botStatus.find(b => b.bot_type === 'telegram')
  const whatsappBot = botStatus.find(b => b.bot_type === 'whatsapp')

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">ربط البوتات</h2>
        <p className="text-gray-600">قم بربط حساباتك من Telegram و WhatsApp للتكامل مع النظام</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Telegram Bot */}
        <div className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Send className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Telegram Bot</h3>
                <p className="text-sm text-gray-600">ربط بوت التيليجرام</p>
              </div>
            </div>
            {telegramBot && getStatusBadge(telegramBot.status)}
          </div>

          {telegramBot && telegramBot.is_active ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-green-800 font-medium mb-2">✅ متصل بنجاح</p>
              {telegramBot.bot_name && (
                <p className="text-sm text-green-700">اسم البوت: {telegramBot.bot_name}</p>
              )}
              {telegramBot.last_ping && (
                <p className="text-xs text-green-600 mt-1">
                  آخر اتصال: {new Date(telegramBot.last_ping).toLocaleString('ar-EG')}
                </p>
              )}
              
              <button
                onClick={() => onTestConnection('telegram')}
                disabled={botLoading === 'telegram'}
                className="mt-3 w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {botLoading === 'telegram' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    جاري الاختبار...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    اختبار الاتصال
                  </>
                )}
              </button>

              <button
                onClick={() => onDisconnect('telegram')}
                disabled={botLoading === 'telegram'}
                className="mt-2 w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {botLoading === 'telegram' ? 'جاري قطع الاتصال...' : 'قطع الاتصال'}
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bot Token
                </label>
                <input
                  type="password"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">
                  احصل عليه من @BotFather في التيليجرام
                </p>
              </div>

              <button
                onClick={onConnectTelegram}
                disabled={botLoading === 'telegram' || !telegramToken.trim()}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {botLoading === 'telegram' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    جاري الاتصال...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    ربط Telegram Bot
                  </>
                )}
              </button>
            </>
          )}

          {telegramBot && telegramBot.error_message && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-800">خطأ: {telegramBot.error_message}</p>
            </div>
          )}
        </div>

        {/* WhatsApp Bot */}
        <div className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">WhatsApp Bot</h3>
                <p className="text-sm text-gray-600">ربط بوت الواتساب</p>
              </div>
            </div>
            {whatsappBot && getStatusBadge(whatsappBot.status)}
          </div>

          {whatsappBot && whatsappBot.is_active ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-green-800 font-medium mb-2">✅ متصل بنجاح</p>
              {whatsappBot.bot_name && (
                <p className="text-sm text-green-700">اسم البوت: {whatsappBot.bot_name}</p>
              )}
              {whatsappBot.last_ping && (
                <p className="text-xs text-green-600 mt-1">
                  آخر اتصال: {new Date(whatsappBot.last_ping).toLocaleString('ar-EG')}
                </p>
              )}
              <button
                onClick={() => onDisconnect('whatsapp')}
                disabled={botLoading === 'whatsapp'}
                className="mt-3 w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {botLoading === 'whatsapp' ? 'جاري قطع الاتصال...' : 'قطع الاتصال'}
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={whatsappApiKey}
                  onChange={(e) => setWhatsappApiKey(e.target.value)}
                  placeholder="EAAF..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number ID
                </label>
                <input
                  type="text"
                  value={whatsappPhoneId}
                  onChange={(e) => setWhatsappPhoneId(e.target.value)}
                  placeholder="123456789012345"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">
                  من Meta Business Dashboard
                </p>
              </div>

              <button
                onClick={onConnectWhatsApp}
                disabled={botLoading === 'whatsapp' || !whatsappApiKey.trim() || !whatsappPhoneId.trim()}
                className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {botLoading === 'whatsapp' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    جاري الاتصال...
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4" />
                    ربط WhatsApp Bot
                  </>
                )}
              </button>
            </>
          )}

          {whatsappBot && whatsappBot.error_message && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-800">خطأ: {whatsappBot.error_message}</p>
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          ملاحظات هامة
        </h4>
        <ul className="text-sm text-blue-800 space-y-1 mr-6 list-disc">
          <li>سيتم تشفير جميع البيانات الحساسة (Tokens, API Keys) قبل التخزين</li>
          <li>لإنشاء Telegram Bot، تواصل مع @BotFather وأنشئ بوت جديد</li>
          <li>للوات Meta Business API للحصول على اعتماد WhatsApp API</li>
          <li>الاتصال يتم التحقق منه مباشرة مع خوادم Telegram/WhatsApp</li>
        </ul>
      </div>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SETTINGS TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SettingsTabProps {
  settings: SystemSetting[]
  onRefresh: () => void
}

function SettingsTab({ settings, onRefresh }: SettingsTabProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">إعدادات النظام</h2>
        <button 
          onClick={onRefresh}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          تحديث
        </button>
      </div>

      <div className="space-y-4">
        {settings.map((setting) => (
          <div key={setting.setting_key} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">{setting.setting_key}</h3>
              <button className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1">
                <Edit2 className="w-4 h-4" />
                تعديل
              </button>
            </div>
            {setting.description && (
              <p className="text-sm text-gray-600 mb-3">{setting.description}</p>
            )}
            <pre className="bg-gray-50 rounded p-3 text-xs overflow-x-auto">
              {JSON.stringify(setting.setting_value, null, 2)}
            </pre>
            <p className="text-xs text-gray-500 mt-2">
              آخر تحديث: {new Date(setting.updated_at).toLocaleString('ar-EG')}
            </p>
          </div>
        ))}
      </div>

      {settings.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Settings className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>لا توجد إعدادات مسجلة</p>
        </div>
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUDIT TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AuditTabProps {
  logs: any[]
  onRefresh: () => void
}

function AuditTab({ logs, onRefresh }: AuditTabProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">سجل الأنشطة</h2>
        <button 
          onClick={onRefresh}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          تحديث
        </button>
      </div>

      <div className="space-y-3">
        {logs.map((log) => (
          <div key={log.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-gray-900">{log.action}</span>
                  <span className="text-xs text-gray-500">في {log.module}</span>
                </div>
                <p className="text-sm text-gray-600 mb-2">المستخدم: {log.user_id}</p>
                {log.details && (
                  <pre className="bg-gray-50 rounded p-2 text-xs overflow-x-auto">
                    {JSON.stringify(JSON.parse(log.details), null, 2)}
                  </pre>
                )}
              </div>
              <div className="text-left">
                <p className="text-xs text-gray-500">
                  {new Date(log.created_at).toLocaleString('ar-EG')}
                </p>
                {log.ip_address && (
                  <p className="text-xs text-gray-400 mt-1">IP: {log.ip_address}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {logs.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>لا توجد أنشطة مسجلة</p>
        </div>
      )}
    </div>
  )
}
