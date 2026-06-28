'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LogIn, Settings, Code, Bug,
  Zap, Database, Lock, Eye, Copy, Check
} from 'lucide-react';

const DEV_SCOPES = [
  { id: 'maintenance', name: 'الهندسة والدعم الفني', color: 'from-rose-600 to-rose-700' },
  { id: 'corrosion', name: 'إدارة التآكل', color: 'from-orange-600 to-orange-700' },
  { id: 'finance', name: 'المالية', color: 'from-amber-600 to-amber-700' },
  { id: 'admin-affairs', name: 'الموارد البشرية', color: 'from-blue-600 to-blue-700' },
  { id: 'materials', name: 'المواد والموارد', color: 'from-teal-600 to-teal-700' },
  { id: 'services', name: 'الذكاء والخدمات', color: 'from-fuchsia-600 to-fuchsia-700' },
  { id: 'remote-sensing', name: 'الاستشعار عن بعد', color: 'from-violet-600 to-violet-700' },
];

const DEV_CREDENTIALS = [
  {
    tenant: 'test-org',
    username: 'dev_user',
    password: 'dev_password_123',
    role: 'manager',
    desc: 'حساب تطوير عام'
  },
  {
    tenant: 'test-org',
    username: 'dev_admin',
    password: 'admin_dev_123',
    role: 'admin',
    desc: 'حساب إدارة'
  },
  {
    tenant: 'demo-system',
    username: 'demo_user',
    password: 'demo_123',
    role: 'user',
    desc: 'حساب ديمو عام'
  },
];

export default function DevPortal() {
  const router = useRouter();
  const [selectedScope, setSelectedScope] = useState<string | null>(null);
  const [selectedCred, setSelectedCred] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const handleQuickLogin = async () => {
    if (!selectedScope) {
      setMessage('اختر إدارة أولاً');
      return;
    }

    setLoading(true);
    setMessage('جاري تسجيل الدخول السريع...');

    try {
      const cred = DEV_CREDENTIALS[selectedCred];
      
      // Call dev quick login API
      const loginRes = await fetch('/api/dev/quick-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_code: cred.tenant,
          username: cred.username,
          password: cred.password,
          scope: selectedScope,
        }),
      });

      if (!loginRes.ok) {
        const err = await loginRes.json().catch(() => null);
        setMessage(`❌ خطأ: ${err?.detail ?? 'فشل تسجيل الدخول'}`);
        setLoading(false);
        return;
      }

      const { token, email, role } = await loginRes.json();

      // Set auth cookie
      document.cookie = `auth_session=true; path=/; SameSite=Lax`;
      document.cookie = `app_scope=${selectedScope}; path=/; SameSite=Lax`;
      
      // Store token
      localStorage.setItem('auth_token', token);
      localStorage.setItem('launch_app', selectedScope);
      if (email) localStorage.setItem('user_email', email);
      if (role) localStorage.setItem('user_role', role);

      setMessage(`✅ تم التسجيل — اذهب إلى ${selectedScope}...`);
      
      // Redirect
      const route = `/dashboard/admin-gateway/${selectedScope}`;
      setTimeout(() => router.push(route), 800);
    } catch (err) {
      setMessage(`❌ خطأ: ${err}`);
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Code className="w-8 h-8 text-cyan-400" />
            <h1 className="text-3xl md:text-4xl font-bold text-white">Developer Portal</h1>
            <Bug className="w-8 h-8 text-amber-400" />
          </div>
          <p className="text-slate-400">أدوات تطوير — Login سريع — اختبار الإدارات</p>
          <div className="pt-2 text-xs text-slate-500">
            ⚠️ <strong>للمطورين فقط</strong> — يتم تعطيل هذه الصفحة في الإنتاج
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Login Panel */}
          <div className="bg-slate-800/50 border border-cyan-500/30 rounded-2xl p-6 space-y-4 backdrop-blur">
            <div className="flex items-center gap-2 text-cyan-400 font-bold">
              <Zap className="w-5 h-5" />
              <span>تسجيل دخول سريع</span>
            </div>

            {/* Credential Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">اختر بيانات الدخول</label>
              <div className="space-y-2">
                {DEV_CREDENTIALS.map((cred, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedCred(idx)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedCred === idx
                        ? 'border-cyan-500 bg-cyan-500/15 ring-1 ring-cyan-500'
                        : 'border-slate-600 bg-slate-700/30 hover:border-cyan-400'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-mono text-sm text-white">{cred.username}</div>
                        <div className="text-xs text-slate-400">{cred.desc}</div>
                      </div>
                      <div className="text-xs px-2 py-1 bg-slate-600 rounded text-slate-200">{cred.role}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Scope Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">اختر الإدارة</label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {DEV_SCOPES.map((scope) => (
                  <button
                    key={scope.id}
                    onClick={() => setSelectedScope(scope.id)}
                    className={`p-3 rounded-lg border text-sm font-medium transition-all text-white ${
                      selectedScope === scope.id
                        ? `border-white bg-gradient-to-r ${scope.color} ring-1 ring-white`
                        : 'border-slate-600 bg-slate-700/30 hover:border-white'
                    }`}
                  >
                    {scope.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Login Button */}
            <button
              onClick={handleQuickLogin}
              disabled={loading || !selectedScope}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
            >
              <LogIn className="w-5 h-5" />
              {loading ? 'جاري...' : 'دخول سريع'}
            </button>

            {/* Message */}
            {message && (
              <div className={`p-3 rounded-lg text-sm text-center ${
                message.includes('❌') ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'
              }`}>
                {message}
              </div>
            )}
          </div>

          {/* Credentials Info */}
          <div className="bg-slate-800/50 border border-amber-500/30 rounded-2xl p-6 space-y-4 backdrop-blur">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <Lock className="w-5 h-5" />
              <span>بيانات الاختبار</span>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {DEV_CREDENTIALS.map((cred, idx) => (
                <div key={idx} className="bg-slate-700/30 border border-slate-600 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-amber-300">{cred.username}</span>
                    <span className="text-xs bg-slate-600 px-2 py-1 rounded text-slate-200">{cred.role}</span>
                  </div>
                  
                  <div className="flex items-center justify-between gap-2 text-slate-300">
                    <code className="bg-slate-900/50 px-2 py-1 rounded text-xs font-mono">{cred.password}</code>
                    <button
                      onClick={() => copyToClipboard(cred.password, `pwd-${idx}`)}
                      className="p-1 hover:bg-slate-600 rounded transition-colors text-slate-400 hover:text-white"
                      title="نسخ كلمة المرور"
                    >
                      {copied === `pwd-${idx}` ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <div className="text-xs text-slate-400">
                    Tenant: <code className="font-mono">{cred.tenant}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tools Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: <Database className="w-5 h-5" />, label: 'Database', href: '/dev/database', color: 'from-green-600' },
            { icon: <Settings className="w-5 h-5" />, label: 'Settings', href: '/dev/settings', color: 'from-purple-600' },
            { icon: <Eye className="w-5 h-5" />, label: 'Logs', href: '/dev/logs', color: 'from-indigo-600' },
          ].map((tool, idx) => (
            <a
              key={idx}
              href={tool.href}
              className={`bg-gradient-to-br ${tool.color} to-slate-900 border border-slate-700 rounded-xl p-4 flex items-center gap-3 hover:shadow-lg hover:shadow-slate-600/50 transition-all group`}
            >
              <div className="p-2 bg-white/10 rounded-lg group-hover:bg-white/20 transition-colors">
                {tool.icon}
              </div>
              <div>
                <div className="font-bold text-white">{tool.label}</div>
                <div className="text-xs text-slate-300">اختبار وتطوير</div>
              </div>
            </a>
          ))}
        </div>

        {/* Environment Info */}
        <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 font-mono text-xs text-slate-400 space-y-1">
          <div>Environment: <span className="text-slate-300">{process.env.NODE_ENV}</span></div>
          <div>API Base: <span className="text-slate-300">{process.env.NEXT_PUBLIC_API_BASE_URL || 'https://dev.d-me.ly'}</span></div>
          <div>Build Date: <span className="text-slate-300">{new Date().toISOString()}</span></div>
        </div>
      </div>
    </div>
  );
}
