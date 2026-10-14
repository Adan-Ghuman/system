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
    <div className="space-y-2 border border-line rounded-lg bg-canvas/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <Keyboard className="w-4 h-4 text-brand" />
          <span>Roll Weights (Enter weight for each roll)</span>
        </div>
        <div className="text-xs text-soft font-mono">
          Press <kbd className="px-1.5 py-0.5 rounded bg-subtle text-strong font-bold border border-control">Enter</kbd> to quickly add next roll
        </div>
      </div>

      <div className="max-h-64 overflow-auto border border-line/80 rounded-md">
        <table className="min-w-[560px] w-full text-left text-xs">
          <thead className="bg-surface sticky top-0 border-b border-line text-soft normal-case font-semibold">
            <tr>
              <th className="py-2 px-3 w-16 text-center">Roll #</th>
              <th className="py-2 px-3">Roll Weight (Gross Kg)</th>
              <th className="py-2 px-3 w-28">Empty / Tare (Kg)</th>
              <th className="py-2 px-3 text-right">Net Fabric (Kg)</th>
              <th className="py-2 px-2 w-10 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/40">
            {rolls.map((roll, idx) => {
              const isLast = idx === rolls.length - 1;
              return (
                <tr key={idx} className="hover:bg-surface/40">
                  <td className="py-1.5 px-3 text-center font-mono font-bold text-soft">
                    #{roll.rollNumber}
                  </td>
                  <td className="py-1.5 px-3">
                    <input
                      aria-label={"Gross weight for roll " + roll.rollNumber}
                      ref={isLast ? lastInputRef : null}
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={roll.grossWeightKg || ''}
                      onChange={(e) => handleWeightChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx)}
                      className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-surface border border-control text-strong focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="py-1.5 px-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      aria-label={"Tare weight for roll " + roll.rollNumber}
                      value={roll.tareKg || ''}
                      onChange={(e) => handleTareChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx)}
                      placeholder="0.00"
                      className="w-full px-2 py-1 text-xs font-mono rounded bg-surface border border-line text-ink focus:outline-hidden focus:border-emerald-500"
                    />
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono font-bold text-brand">
                    {roll.netWeightKg.toFixed(2)}
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveRoll(idx)}
                      disabled={rolls.length <= 1}

                      className="text-soft hover:text-danger disabled:opacity-30 transition-colors p-1"
                      title="Delete roll row"
                      aria-label={"Remove roll " + roll.rollNumber}
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

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddRoll}
          className="gap-1 text-xs py-1 h-7"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Next Roll
        </Button>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-soft text-xs mr-1 normal-case">Total Rolls:</span>
            <span className="font-bold text-strong">{totals.rollsCount}</span>
          </div>
          <div>
            <span className="text-soft text-xs mr-1 normal-case">Avg Weight:</span>
            <span className="text-ink">{avgRollWeight.toFixed(2)} Kg</span>
          </div>
          <div>
            <span className="text-soft text-xs mr-1 normal-case">Total Net Weight:</span>
            <span className="font-bold text-brand text-sm">{formatWeight(totals.totalNet)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
