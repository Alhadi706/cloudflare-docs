'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Search, ChevronLeft, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import CsvUploader from '@/components/CsvUploader';

interface AttendanceRecord {
  id: number;
  employee_id: number;
  employee?: { full_name: string; full_name_ar?: string };
  date: string;
  check_in?: string;
  check_out?: string;
  status: string;
  work_hours?: number;
  overtime_hours?: number;
  notes?: string;
}

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchAttendance();
  }, [dateFilter]);

  const fetchAttendance = async () => {
    try {
      const response = await fetch(`/api/v1/hr/attendance?date=${dateFilter}`);
      if (response.ok) {
        const data = await response.json();
        setRecords(data.attendance || []);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'present': return 'text-emerald-400 bg-emerald-500/10';
      case 'absent': return 'text-rose-400 bg-rose-500/10';
      case 'late': return 'text-amber-400 bg-amber-500/10';
      case 'leave': return 'text-blue-400 bg-blue-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const present = records.filter(r => r.status === 'present').length;
  const absent = records.filter(r => r.status === 'absent').length;
  const late = records.filter(r => r.status === 'late').length;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway">بوابة النظام</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/hr">الموارد البشرية</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-200">الحضور والانصراف</span>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-green-600/20 p-4 rounded-xl border border-green-500/50">
              <Clock className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-100">الحضور والانصراف</h1>
              <p className="text-slate-400 mt-1">سجل الدوام اليومي للموظفين</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CsvUploader module="hr" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">الحاضرون</span>
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{present}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">الغائبون</span>
              <XCircle className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{absent}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">متأخرون</span>
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{late}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">نسبة الحضور</span>
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">
              {records.length > 0 ? Math.round((present / records.length) * 100) : 0}%
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400">جاري التحميل...</div>
            ) : records.length === 0 ? (
              <div className="p-12 text-center">
                <Clock className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg">لا توجد سجلات لهذا التاريخ</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الموظف</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">التاريخ</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">وقت الحضور</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">وقت الانصراف</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">ساعات العمل</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">العمل الإضافي</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-slate-300">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-200">
                        {record.employee?.full_name_ar || record.employee?.full_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {new Date(record.date).toLocaleDateString('ar-LY')}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {record.check_in || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {record.check_out || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300 font-medium">
                        {record.work_hours ? `${record.work_hours} ساعة` : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-amber-400">
                        {record.overtime_hours ? `${record.overtime_hours} ساعة` : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
