import { useState, useEffect } from 'react';
import { create } from 'zustand';
import { Dialog } from './Dialog.js';
import { Input } from './Input.js';
import { Button } from './Button.js';

interface ReasonState { message: string; finish: ((reason: string | null) => void) | null; }
const useReasonState = create<ReasonState>(() => ({ message: '', finish: null }));
export function requestReason(message: string): Promise<string | null> {
  useReasonState.getState().finish?.(null);
  return new Promise(resolve => useReasonState.setState({ message, finish: resolve }));
}
export function ReasonDialog() {
  const { message, finish } = useReasonState();
  const [reason, setReason] = useState('');
  useEffect(() => () => { useReasonState.getState().finish?.(null);useReasonState.setState({ message: '', finish: null }); }, []);
  function close(value: string | null) { finish?.(value);useReasonState.setState({ message: '', finish: null });setReason(''); }
  return <Dialog isOpen={Boolean(finish)} onClose={() => close(null)} title="Reverse a posted record" description={message} footer={<><Button variant="outline" onClick={() => close(null)}>Cancel</Button><Button form="reversal-reason" type="submit">Reverse record</Button></>}><form id="reversal-reason" onSubmit={event => { event.preventDefault();close(reason.trim()); }}><Input label="Reason for reversal" required minLength={3} value={reason} onChange={event => setReason(event.target.value)} placeholder="e.g. Incorrect received weight" /></form></Dialog>;
}
