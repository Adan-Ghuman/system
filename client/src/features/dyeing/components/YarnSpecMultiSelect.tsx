import { Input } from '../../../components/ui/Input.js';
import { Check, Plus, Layers } from 'lucide-react';

export const STANDARD_YARN_SPECS = [
  '150/144 Micro',
  '150/48 Rotto',
  '100/144 Micro',
  '100/36 Sim',
  '75/72 Sim',
  '75/36 Sim',
  '30/1 Cotton',
  '20/1 Cotton',
  '50D Spandex'
];

export interface YarnSpecMultiSelectProps {
  selectedSpecs: string[];
  onChange: (specs: string[]) => void;
  customSpec: string;
  onCustomSpecChange: (custom: string) => void;
  isOtherActive: boolean;
  onToggleOther: (active: boolean) => void;
  label?: string;
  required?: boolean;
}

export function YarnSpecMultiSelect({
  selectedSpecs,
  onChange,
  customSpec,
  onCustomSpecChange,
  isOtherActive,
  onToggleOther,
  label = 'Yarn Specifications (Select One or More)',
  required = true
}: YarnSpecMultiSelectProps) {
  function toggleSpec(spec: string) {
    if (selectedSpecs.includes(spec)) {
      onChange(selectedSpecs.filter((s) => s !== spec));
    } else {
      onChange([...selectedSpecs, spec]);
    }
  }

  function handleClearAll() {
    onChange([]);
    onCustomSpecChange('');
    onToggleOther(false);
  }

  const allActiveSpecs = [
    ...selectedSpecs,
    ...(isOtherActive && customSpec.trim() ? [customSpec.trim()] : [])
  ];
  const combinedSummary = allActiveSpecs.join(' + ');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-brand" />
          <span>{label}</span>
          {required && <span className="text-danger">*</span>}
        </label>
        {allActiveSpecs.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs text-soft hover:text-strong transition-colors underline cursor-pointer"
          >
            Clear selection
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-surface/90 border border-line">
        {STANDARD_YARN_SPECS.map((spec) => {
          const isSelected = selectedSpecs.includes(spec);
          return (
            <button
              key={spec}
              type="button"
              onClick={() => toggleSpec(spec)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all select-none cursor-pointer ${
                isSelected
                  ? 'bg-primary/30 text-brand border border-emerald-500/60 shadow-xs'
                  : 'bg-canvas/70 text-soft border border-line hover:border-control hover:text-strong'
              }`}
            >
              {isSelected ? (
                <Check className="w-3 h-3 text-brand shrink-0" />
              ) : (
                <Plus className="w-3 h-3 text-soft shrink-0" />
              )}
              <span>{spec}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onToggleOther(!isOtherActive)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all select-none cursor-pointer ${
            isOtherActive
              ? 'bg-blue-600/30 text-info border border-blue-500/60 shadow-xs'
              : 'bg-canvas/70 text-soft border border-line hover:border-control hover:text-strong'
          }`}
        >
          {isOtherActive ? (
            <Check className="w-3 h-3 text-info shrink-0" />
          ) : (
            <Plus className="w-3 h-3 text-soft shrink-0" />
          )}
          <span>Other Spec...</span>
        </button>
      </div>

      {isOtherActive && (
        <div className="pt-1">
          <Input
            id="customYarnSpecInput"
            label="Custom Yarn Specification"
            value={customSpec}
            onChange={(e) => onCustomSpecChange(e.target.value)}
            placeholder="e.g. 40/1 Combed Cotton, 70D Lycra..."
            required={selectedSpecs.length === 0}
          />
        </div>
      )}

      {combinedSummary ? (
        <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-surface border border-line/80 text-xs">
          <span className="text-soft font-medium">Combined Specification:</span>
          <span className="font-mono font-bold text-brand truncate text-right">
            {combinedSummary}
          </span>
        </div>
      ) : (
        <p className="text-xs text-soft italic">
          Select one or multiple yarn counts above to compose the fabric specification.
        </p>
      )}
    </div>
  );
}
