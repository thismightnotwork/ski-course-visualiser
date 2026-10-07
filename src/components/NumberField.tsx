import { useEffect, useState } from 'react';

interface Props {
  label: string;
  value: number | null;
  unit?: string;
  nullable?: boolean;
  onCommit: (value: number | null) => boolean | void;
}

const fmt = (v: number | null) => (v === null ? '' : String(Math.round(v * 1000) / 1000));

export default function NumberField({ label, value, unit, nullable = false, onCommit }: Props) {
  const [text, setText] = useState(fmt(value));
  useEffect(() => {
    setText(fmt(value));
  }, [value]);

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed === '') {
      if (nullable) onCommit(null);
      else setText(fmt(value));
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || onCommit(n) === false) setText(fmt(value));
  };

  return (
    <label className="block text-sm">
      {label}
      {unit ? ` (${unit})` : ''}
      <input
        inputMode="decimal"
        className="mt-1 w-full rounded border border-slate-400 bg-white p-1 dark:bg-slate-800"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}
