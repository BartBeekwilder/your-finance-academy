// Amounts typed as a small sum — "1,22+12,52+13,15", "3*4,50", "20-2,5" —
// as on a receipt. Pure (no imports), so it's tested with plain node and
// ported to the apps.
//
// Numbers accept a comma or a point as the decimal mark, and thousands
// separators ("1.234,56", "1,234.56"). Stray separators at a number's ends
// (",13,15" typed while fixing a mistake) are forgiven. Multiply and divide
// go before add and subtract.

/** One number, or null. */
export function parseNumber(raw: string): number | null {
  let s = raw.replace(/^[.,]+|[.,]+$/g, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const comma = s.lastIndexOf(","), point = s.lastIndexOf(".");
  if (comma >= 0 && point >= 0) {
    // Both: the last one is the decimal mark.
    s = comma > point ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (comma >= 0) {
    // "13,15" decimal; "1,234" or "12,345,678" thousands; else the last
    // comma is the decimal mark.
    s = /^\d{1,3}(,\d{3})+$/.test(s) && s.split(",").length > 2 ? s.replace(/,/g, "") : s.replace(/,(?=.*,)/g, "").replace(",", ".");
  } else if (point >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s) && s.split(".").length > 2) {
    s = s.replace(/\./g, "");
  } else if (point >= 0) {
    s = s.replace(/\.(?=.*\.)/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** The value of an amount or a sum, rounded to cents; null when it can't be
 *  read. `isSum` tells whether there was arithmetic to show a result for. */
export function evalAmount(input: string): { value: number; isSum: boolean } | null {
  const s = input.replace(/\s|€/g, "").replace(/[×xX]/g, "*").replace(/[÷:]/g, "/").replace(/[−–]/g, "-");
  if (!s) return null;
  const parts = s.split(/([+\-*/])/).filter((p) => p !== "");
  // A leading minus belongs to the first number.
  if (parts[0] === "-") parts.splice(0, 2, `-${parts[1] ?? ""}`);
  // Ignore a trailing operator while typing ("12,50+").
  if (/^[+\-*/]$/.test(parts[parts.length - 1])) parts.pop();
  const nums: number[] = [], ops: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      if (!/^[+\-*/]$/.test(parts[i])) return null;
      ops.push(parts[i]);
      continue;
    }
    const neg = parts[i].startsWith("-");
    const n = parseNumber(neg ? parts[i].slice(1) : parts[i]);
    if (n == null) return null;
    nums.push(neg ? -n : n);
  }
  if (!nums.length) return null;
  // Multiply / divide first, then add / subtract.
  const terms = [nums[0]], signs: string[] = [];
  ops.forEach((op, k) => {
    const n = nums[k + 1];
    if (op === "*") terms[terms.length - 1] *= n;
    else if (op === "/") terms[terms.length - 1] = n === 0 ? NaN : terms[terms.length - 1] / n;
    else {
      signs.push(op);
      terms.push(n);
    }
  });
  const value = terms.reduce((sum, t, k) => (k === 0 ? t : signs[k - 1] === "-" ? sum - t : sum + t), 0);
  if (!Number.isFinite(value)) return null;
  return { value: Math.round(value * 100) / 100, isSum: ops.length > 0 };
}
