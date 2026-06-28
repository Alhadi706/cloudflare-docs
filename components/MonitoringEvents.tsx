// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Monitoring Events Display Component
// Shows real-time alerts, warnings, and system events
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Info, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

interface MonitoringEvent {
  id: number;
  event_type: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  message: string;
  entity_type?: string;
  entity_id?: string;
  source?: string;
  created_at: string;
  metadata?: Record<string, any>;
}

interface MonitoringEventsProps {
  limit?: number;
  severity?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export default function MonitoringEvents({
  limit = 20,
  severity,
  autoRefresh = true,
  refreshInterval = 10000
}: MonitoringEventsProps) {
  const [events, setEvents] = useState<MonitoringEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async (signal?: AbortSignal) => {
    try {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      if (severity) params.append('severity', severity);

      const response = await fetch(`/api/v1/monitoring/events?${params.toString()}`, { signal });
      
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
        setError(null);
      } else {
        setError('فشل في تحميل الأحداث');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.error('Failed to fetch monitoring events:', err);
      setError('خطأ في الاتصال بالنظام');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchEvents(controller.signal);

    if (autoRefresh) {
      const interval = setInterval(() => fetchEvents(controller.signal), refreshInterval);
      return () => {
        clearInterval(interval);
        controller.abort();
      };
    }

    return () => controller.abort();
  }, [limit, severity, autoRefresh, refreshInterval]);

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-5 h-5 text-rose-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-400" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-slate-400" />;
    }
  };

  const getBackgroundColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-900/20 border-rose-500/30';
      case 'warning':
        return 'bg-amber-900/20 border-amber-500/30';
      case 'info':
        return 'bg-blue-900/20 border-blue-500/30';
      case 'success':
        return 'bg-emerald-900/20 border-emerald-500/30';
      default:
        return 'bg-slate-900/50 border-slate-700';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    return `منذ ${days} يوم`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-900/20 border border-rose-500/30 rounded-lg p-4">
        <div className="flex items-center gap-2 text-rose-400">
          <XCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-8 text-center">
        <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
        <p className="text-slate-400">لا توجد أحداث حالياً</p>
        <p className="text-xs text-slate-500 mt-1">النظام يعمل بشكل طبيعي</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <div
          key={event.id}
          className={`p-4 rounded-lg border transition-colors hover:bg-slate-800/50 ${getBackgroundColor(event.severity)}`}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">{getIcon(event.severity)}</div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-white font-medium leading-tight">
                  {event.message}
                </p>
                <span className="text-xs text-slate-500 whitespace-nowrap flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimestamp(event.created_at)}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-slate-400">
                {event.event_type && (
                  <span className="px-2 py-0.5 bg-slate-800 rounded">
                    {event.event_type}
                  </span>
                )}
                {event.entity_type && event.entity_id && (
                  <span className="flex items-center gap-1">
                    <span className="opacity-70">{event.entity_type}:</span>
                    <span className="font-mono">{event.entity_id}</span>
                  </span>
                )}
                {event.source && (
                  <span className="opacity-70">
                    من: {event.source}
                  </span>
                )}
              </div>

              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-700/50">
                  <div className="text-xs text-slate-400 space-y-1">
                    {Object.entries(event.metadata).slice(0, 3).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="opacity-70">{key}:</span>
                        <span className="font-mono">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Compact Version (For Sidebar/Dashboard Widget)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function CompactMonitoringEvents({ limit = 5 }: { limit?: number }) {
  const [events, setEvents] = useState<MonitoringEvent[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchEvents = async () => {
      try {
        const response = await fetch(`/api/v1/monitoring/events?limit=${limit}&severity=critical,warning`, {
          signal: controller.signal,
        });
        if (response.ok) {
          const data = await response.json();
          setEvents(data.events || []);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.error('Failed to fetch events:', error);
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 15000);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [limit]);

  if (events.length === 0) {
    return (
      <div className="text-sm text-slate-400 text-center py-2">
        <CheckCircle className="w-4 h-4 inline-block mr-1 text-emerald-400" />
        لا توجد تنبيهات
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {events.map((event) => (
        <div
          key={event.id}
          className="flex items-center gap-2 p-2 bg-slate-900/50 rounded text-xs hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex-shrink-0">
            {event.severity === 'critical' ? (
              <XCircle className="w-4 h-4 text-rose-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            )}
          </div>
          <span className="text-slate-300 truncate flex-1">
            {event.message}
          </span>
        </div>
      ))}
    </div>
  );
}
