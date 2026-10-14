import { create } from 'zustand';

interface BusinessState { id: string; setBusiness: (id: string) => void; }
export const useBusinessStore = create<BusinessState>(set => ({
  id: window.location.pathname.match(/^\/b\/([a-f0-9]{24})(?:\/|$)/i)?.[1] || localStorage.getItem('rozain-business') || '',
  setBusiness: id => { localStorage.setItem('rozain-business', id); set({ id }); }
}));
