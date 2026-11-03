import { useState, useEffect } from 'react';
import { create } from 'zustand';
import { Dialog } from './Dialog.js';
import { Input } from './Input.js';
import { Button } from './Button.js';
import { ShortageOption } from './ShortageOption.js';

interface ReasonResult { reason: string; shortageReason?: string; }
interface ReasonState {
  message: string;
  stock: boolean;
  finish: ((result: ReasonResult | null) => void) | null;
}

const useReasonState = create<ReasonState>(() => ({ message: '', stock: false, finish: null }));

function ask(message: string, stock: boolean): Promise<ReasonResult | null> {
  useReasonState.getState().finish?.(null);
  return new Promise(resolve => useReasonState.setState({ message, stock, finish: resolve }));
}

export async function requestReason(message: string): Promise<string | null> {
  return (await ask(message, false))?.reason || null;
}

export function requestStockReversal(message: string) {
  return ask(message, true);
}

export function ReasonDialog() {
  const { message, stock, finish } = useReasonState();
  const [reason, setReason] = useState('');
  const [shortageReason, setShortageReason] = useState<string>();
  useEffect(() => () => {
    useReasonState.getState().finish?.(null);
    useReasonState.setState({ message: '', stock: false, finish: null });
  }, []);
  function close(result: ReasonResult | null) {
    finish?.(result);
    useReasonState.setState({ message: '', stock: false, finish: null });
    setReason('');
    setShortageReason(undefined);
  }
  return <Dialog isOpen={Boolean(finish)} onClose={() => close(null)} title="Reverse a posted record" description={message}
    footer={<><Button variant="outline" onClick={() => close(null)}>Cancel</Button><Button form="reversal-reason" type="submit">Reverse record</Button></>}>
    <form id="reversal-reason" className="space-y-3" onSubmit={event => {
      event.preventDefault();
      close({ reason: reason.trim(), shortageReason: stock ? shortageReason?.trim() : undefined });
    }}>
      <Input label="Reason for reversal" required minLength={3} value={reason} onChange={event => setReason(event.target.value)} placeholder="e.g. Incorrect received weight" />
      {stock && <ShortageOption value={shortageReason} onChange={setShortageReason} />}
    </form>
  </Dialog>;
}
