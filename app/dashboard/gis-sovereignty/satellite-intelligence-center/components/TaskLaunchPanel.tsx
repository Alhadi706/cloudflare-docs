'use client';
/**
 * TaskLaunchPanel — stub to restore build.
 * Full implementation pending; shows a placeholder panel.
 */
import React from 'react';
import { Rocket } from 'lucide-react';

export type TaskMode = string;

export const TASKS: Array<{ id: TaskMode; label: string; steps: string[] }> = [];

export function TaskGuideBar({
  taskId,
  onClearTask,
}: {
  taskId: TaskMode;
  onClearTask: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-indigo-900/40 border-b border-indigo-500/20 text-xs text-indigo-300">
      <Rocket className="w-3.5 h-3.5" />
      <span>المهمة: {taskId}</span>
      <button onClick={onClearTask} className="ml-auto text-indigo-400 hover:text-white">✕</button>
    </div>
  );
}

export default function TaskLaunchPanel({
  onSelectTask,
}: {
  onSelectTask?: (mode: TaskMode) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-500">
      <Rocket className="w-8 h-8 opacity-30" />
      <p className="text-xs">اختر مهمة للبدء</p>
    </div>
  );
}
