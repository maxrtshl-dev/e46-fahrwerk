import { useEffect, useState } from "react";

/** Zahlenfeld, das Komma und Punkt annimmt (iPhone-Tastatur liefert Komma). */
export function NumField({
  id,
  value,
  onChange,
  allowEmpty = false,
  placeholder,
  className,
}: {
  id: string;
  value: number | null;
  onChange: (v: number | null) => void;
  allowEmpty?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const fmt = (v: number | null) => (v === null ? "" : String(v).replace(".", ","));
  const [text, setText] = useState(fmt(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setText(fmt(value));
  }, [value, focus]);

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      value={text}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const norm = t.replace(",", ".").trim();
        if (norm === "") {
          if (allowEmpty) onChange(null);
          return;
        }
        const n = Number(norm);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}
