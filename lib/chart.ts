export function genSeries(n: number, growth: number, noise: number, start: number) {
  const pts = [start];
  for (let i = 1; i < n; i++) {
    const v = pts[i - 1] * growth + (Math.random() - 0.5) * noise;
    pts.push(Math.max(v, pts[i - 1] * 0.985));
  }
  return pts;
}

export function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function fitCanvas(canvas: HTMLCanvasElement, cssHeight: number) {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = cssHeight * ratio;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, w: rect.width, h: cssHeight };
}

export function drawLine(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  series: number[],
  max: number,
  color: string,
  lw: number,
  progress: number
) {
  const n = series.length;
  const count = Math.max(2, Math.floor(n * progress));
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const x = (i / (n - 1)) * w;
    const y = h - (series[i] / max) * (h - 14) - 6;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
  return count;
}
