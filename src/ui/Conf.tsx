import type { Confidence } from "../core/data";

export function Conf({ c }: { c: Confidence }) {
  return <span className={`conf conf-${c === "geschätzt" ? "geschaetzt" : c}`}>{c}</span>;
}
