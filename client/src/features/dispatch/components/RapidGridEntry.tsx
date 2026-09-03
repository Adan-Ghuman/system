import { useRef, useEffect, KeyboardEvent } from 'react';
import { DispatchRollItem } from '../types/dispatch.types.js';
import { Button } from '../../../components/ui/Button.js';
import { formatWeight } from '../../../lib/formatters.js';
import { Plus, Trash2, Keyboard } from 'lucide-react';

export interface RapidGridEntryProps {
  rolls: DispatchRollItem[];
  onChange: (rolls: DispatchRollItem[]) => void;
}

export function RapidGridEntry({ rolls, onChange }: RapidGridEntryProps) {
  const lastInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (rolls.length === 0) {
      onChange([
        { rollNumber: 1, grossWeightKg: 22.5, tareKg: 0, netWeightKg: 22.5 }
      ]);
    }
  }, [rolls, onChange]);

  function handleAddRoll() {
    const nextNum = rolls.length > 0 ? Math.max(...rolls.map((r) => r.rollNumber)) + 1 : 1;
    const prevWeight = rolls.length > 0 ? rolls[rolls.length - 1].grossWeightKg : 22.0;
    const newRolls = [
      ...rolls,
      { rollNumber: nextNum, grossWeightKg: prevWeight, tareKg: 0, netWeightKg: prevWeight }
    ];
    onChange(newRolls);
    setTimeout(() => {
      lastInputRef.current?.focus();
      lastInputRef.current?.select();
    }, 50);
  }

  function handleRemoveRoll(index: number) {
    if (rolls.length <= 1) return;
    const newRolls = rolls.filter((_, idx) => idx !== index);
    const renumbered = newRolls.map((r, idx) => ({ ...r, rollNumber: idx + 1 }));
    onChange(renumbered);
  }

  function handleWeightChange(index: number, val: string) {
    const gross = parseFloat(val) || 0;
    const updated = [...rolls];
    const tare = updated[index].tareKg || 0;
    const net = Math.max(0, Math.round((gross - tare) * 100) / 100);
    updated[index] = {
      ...updated[index],
      grossWeightKg: gross,
      netWeightKg: net
    };
    onChange(updated);
  }

  function handleTareChange(index: number, val: string) {
    const tare = parseFloat(val) || 0;
    const updated = [...rolls];
    const gross = updated[index].grossWeightKg || 0;
    const net = Math.max(0, Math.round((gross - tare) * 100) / 100);
    updated[index] = {
      ...updated[index],
      tareKg: tare,
      netWeightKg: net
    };
    onChange(updated);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === rolls.length - 1) {
        handleAddRoll();
      }
    }
  }

  const totals = rolls.reduce(
    (acc, r) => {
      acc.rollsCount += 1;
      acc.totalGross += r.grossWeightKg;
      acc.totalTare += r.tareKg;
      acc.totalNet += r.netWeightKg;
      return acc;
    },
    { rollsCount: 0, totalGross: 0, totalTare: 0, totalNet: 0 }
  );

  const avgRollWeight = totals.rollsCount > 0 ? totals.totalNet / totals.rollsCount : 0;

  return (
    <div className="space-y-2 border border-zinc-800 rounded-lg bg-zinc-950/60 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
          <Keyboard className="w-4 h-4 text-emerald-400" />
          <span>RapidGridEntry • Keyboard-First Roll Weighing Table</span>
        </div>
        <div className="text-[11px] text-zinc-500 font-mono">
          Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold border border-zinc-700">Enter</kbd> to add roll
        </div>
      </div>

      <div className="max-h-56 overflow-y-auto border border-zinc-800/80 rounded-md">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900 sticky top-0 border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
            <tr>
              <th className="py-2 px-3 w-16 text-center">Roll #</th>
              <th className="py-2 px-3">Gross Wt (Kg)</th>
              <th className="py-2 px-3 w-24">Tare (Kg)</th>
              <th className="py-2 px-3 text-right">Net Wt (Kg)</th>
              <th className="py-2 px-2 w-10 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {rolls.map((roll, idx) => {
              const isLast = idx === rolls.length - 1;
              return (
                <tr key={idx} className="hover:bg-zinc-900/40">
                  <td className="py-1.5 px-3 text-center font-mono font-bold text-zinc-400">
                    #{roll.rollNumber}
                  </td>
                  <td className="py-1.5 px-3">
                    <input
                      ref={isLast ? lastInputRef : null}
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={roll.grossWeightKg || ''}
                      onChange={(e) => handleWeightChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx)}
                      className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="py-1.5 px-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={roll.tareKg || ''}
                      onChange={(e) => handleTareChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx)}
                      placeholder="0.00"
                      className="w-full px-2 py-1 text-xs font-mono rounded bg-zinc-900 border border-zinc-800 text-zinc-300 focus:outline-hidden focus:border-emerald-500"
                    />
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono font-bold text-emerald-400">
                    {roll.netWeightKg.toFixed(2)}
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveRoll(idx)}
                      disabled={rolls.length <= 1}
                      tabIndex={-1}
                      className="text-zinc-600 hover:text-red-400 disabled:opacity-30 transition-colors p-1"
                      title="Delete roll row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddRoll}
          className="gap-1 text-xs py-1 h-7"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Roll Row
        </Button>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-zinc-500 text-[10px] mr-1 uppercase">Rolls:</span>
            <span className="font-bold text-zinc-200">{totals.rollsCount}</span>
          </div>
          <div>
            <span className="text-zinc-500 text-[10px] mr-1 uppercase">Avg:</span>
            <span className="text-zinc-300">{avgRollWeight.toFixed(2)} Kg</span>
          </div>
          <div>
            <span className="text-zinc-500 text-[10px] mr-1 uppercase">Total Net:</span>
            <span className="font-bold text-emerald-400 text-sm">{formatWeight(totals.totalNet)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
