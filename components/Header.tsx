import React from 'react';
import { LayoutDashboard } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';

const Header = () => {
    return (
        <header className="h-16 bg-slate-900 border-b border-slate-700/50 flex items-center justify-between px-6">
            <div className="flex items-center gap-3">
                <LayoutDashboard className="text-blue-400 w-5 h-5" />
                <span className="text-sm font-semibold text-slate-200">منظومة الإدارة الرقمية</span>
            </div>
            <div className="flex items-center gap-3">
                <NotificationBell />
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    <span className="text-xs text-slate-400 font-mono">متصل</span>
                </div>
            </div>
        </header>
    );
};

export default Header;
