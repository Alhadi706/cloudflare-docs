import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
}

interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  addMessage: (msg: Omit<ChatMessage, 'id'>) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [
    {
      id: '1',
      sender: 'ai',
      text: 'مرحباً! أنا المساعد الذكي الخاص بنظام السيادة الجغرافية. كيف يمكنني مساعدتك اليوم؟\n\nيمكنني تحليل الطبقات، البحث عن الإحداثيات، أو مساعدتك في أدوات الرسم.'
    }
  ],
  isOpen: false,
  setIsOpen: (isOpen) => set({ isOpen }),
  addMessage: (msg) => set((state) => ({
    messages: [...state.messages, { ...msg, id: Date.now().toString() }]
  }))
}));
