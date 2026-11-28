"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { spendByCategory, spendByCategoryYear, summarize } from "@/lib/finance/calc";
import { money } from "@/lib/finance/format";
import type { FinanceData } from "@/lib/finance/types";
import { t } from "@/lib/i18n";
import { useMotionMode } from "@/lib/motion";
import type { Mode } from "./LiveTiles";
import Segmented from "./Segmented";

// The spend cube (Bart, 28 Nov): the period's spending as one cube, each
// category a block whose volume is its share. Split like a treemap in three
// dimensions — the list in two halves of about equal spend, the box cut
// along its longest side, again and again — so big costs are big blocks.
// Drag to turn it, point at a block to read it, "Apart" pulls the blocks
// away from each other. Fixed costs are solid, variable ones glassier.

type Item = { key: string; name: string; color: string; amount: number; fixed: boolean };
type Box = { x: number; y: number; z: number; w: number; h: number; d: number };
type Placed = Item & { box: Box };

const hex = (c: string | null | undefined) => (!c ? "#8e8e93" : c.startsWith("#") ? c : `#${c}`);

/** Treemap in 3D: split the items into two halves of about equal sum and
 *  cut the box along its longest side in that proportion, recursively. */
function layout(items: Item[], box: Box): Placed[] {
  if (!items.length) return [];
  if (items.length === 1) return [{ ...items[0], box }];
  const total = items.reduce((s, x) => s + x.amount, 0);
  let acc = 0, k = 0;
  while (k < items.length - 1 && acc + items[k].amount <= total / 2) acc += items[k++].amount;
  if (k === 0) { acc = items[0].amount; k = 1; }
  const f = acc / total;
  const a = items.slice(0, k), b = items.slice(k);
  const { x, y, z, w, h, d } = box;
  if (w >= h && w >= d) return [...layout(a, { x, y, z, w: w * f, h, d }), ...layout(b, { x: x + w * f, y, z, w: w * (1 - f), h, d })];
  if (h >= d) return [...layout(a, { x, y, z, w, h: h * f, d }), ...layout(b, { x, y: y + h * f, z, w, h: h * (1 - f), d })];
  return [...layout(a, { x, y, z, w, h, d: d * f }), ...layout(b, { x, y, z: z + d * f, w, h, d: d * (1 - f) })];
}

function useItems(data: FinanceData, now: Date, mode: Mode): Item[] {
  return useMemo(() => {
    const rows = mode === "month" ? spendByCategory(data, new Date(now.getFullYear(), now.getMonth(), 1)) : spendByCategoryYear(data, now.getFullYear());
    const items: Item[] = rows.filter((r) => r.spent > 0.5).map((r) => ({ key: r.category.id, name: r.category.name, color: hex(r.category.color_hex), amount: r.spent, fixed: !!r.category.is_fixed_expense }));
    if (mode === "month") {
      const s = summarize(data.transactions, new Date(now.getFullYear(), now.getMonth(), 1));
      const loose = s.spent - items.reduce((a, x) => a + x.amount, 0);
      if (loose > 0.5) items.push({ key: "uncategorized", name: t("No category"), color: "#636366", amount: loose, fixed: false });
    }
    // Fixed costs at the bottom of the cube, then by size.
    return items.sort((a, b) => Number(b.fixed) - Number(a.fixed) || b.amount - a.amount);
  }, [data, now, mode]);
}

export default function SpendCube({ data, now, mode, currency }: { data: FinanceData; now: Date; mode: Mode; currency: string }) {
  const items = useItems(data, now, mode);
  const total = items.reduce((s, x) => s + x.amount, 0);
  const mount = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [apart, setApart] = useState<"together" | "apart">("together");
  const apartRef = useRef(0);
  const hoverRef = useRef<string | null>(null);
  const motion = useMotionMode();
  useEffect(() => { apartRef.current = apart === "apart" ? 1 : 0; }, [apart]);
  useEffect(() => { hoverRef.current = hover; }, [hover]);

  useEffect(() => {
    const el = mount.current;
    if (!el || !items.length) return;
    const width = el.clientWidth, height = el.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    camera.position.set(4.3, 3.1, 5.0);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(4, 6, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0x64d2ff, 0.5); rim.position.set(-5, 2, -4); scene.add(rim);

    // The cube: 2 × 2 × 2, centred.
    const S = 2;
    // Fixed costs as the cube's base layer, the variable ones on top.
    const fixedItems = items.filter((x) => x.fixed), varItems = items.filter((x) => !x.fixed);
    const fh = S * (fixedItems.reduce((a, x) => a + x.amount, 0) / items.reduce((a, x) => a + x.amount, 0));
    const placed = [
      ...layout(fixedItems, { x: -S / 2, y: -S / 2, z: -S / 2, w: S, h: fh, d: S }),
      ...layout(varItems, { x: -S / 2, y: -S / 2 + fh, z: -S / 2, w: S, h: S - fh, d: S }),
    ];
    const group = new THREE.Group();
    scene.add(group);
    const gap = 0.025;
    const blocks = placed.map((p, i) => {
      const { box } = p;
      const geo = new THREE.BoxGeometry(Math.max(box.w - gap, 0.01), Math.max(box.h - gap, 0.01), Math.max(box.d - gap, 0.01));
      const color = new THREE.Color(p.color);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: p.fixed ? 0.45 : 0.25, metalness: 0.1, transparent: true, opacity: p.fixed ? 0.95 : 0.8, emissive: color, emissiveIntensity: 0.08 });
      const mesh = new THREE.Mesh(geo, mat);
      const centre = new THREE.Vector3(box.x + box.w / 2, box.y + box.h / 2, box.z + box.d / 2);
      mesh.position.copy(centre);
      mesh.userData = { key: p.key, centre, born: i * 0.06, fixed: p.fixed };
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 }));
      mesh.add(edges);
      mesh.scale.setScalar(0.001);
      group.add(mesh);
      return mesh;
    });

    // Drag to turn (with a little inertia); otherwise it turns slowly by itself.
    let rotY = -0.5, rotX = 0.12, velY = 0, velX = 0, dragging = false, lastX = 0, lastY = 0, idle = 0;
    const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(-9, -9);
    const onDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; renderer.domElement.setPointerCapture(e.pointerId); };
    const onMove = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      if (!dragging) return;
      velY = (e.clientX - lastX) * 0.008; velX = (e.clientY - lastY) * 0.006;
      rotY += velY; rotX = Math.max(-0.9, Math.min(0.9, rotX + velX));
      lastX = e.clientX; lastY = e.clientY; idle = 0;
    };
    const onUp = () => { dragging = false; };
    const onLeave = () => { pointer.set(-9, -9); setHover(null); };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointerleave", onLeave);

    const still = motion === "off";
    const clock = new THREE.Clock();
    let spread = 0, raf = 0, lastHit: string | null = null;
    const frame = () => {
      const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
      if (!dragging) {
        idle += dt;
        velY *= 0.92; velX *= 0.9;
        rotY += velY + (still || idle < 2 ? 0 : dt * 0.18);
        rotX = Math.max(-0.9, Math.min(0.9, rotX + velX));
      }
      group.rotation.set(rotX, rotY, 0);
      spread += ((apartRef.current ? 0.45 : 0) - spread) * Math.min(dt * 6, 1);
      for (const m of blocks) {
        const u = m.userData as { key: string; centre: THREE.Vector3; born: number };
        // Grow in one by one with a little overshoot.
        const g = still ? 1 : Math.min(Math.max((time - u.born) / 0.55, 0), 1);
        const s = g >= 1 ? 1 : 1 - Math.pow(1 - g, 3) * Math.cos(g * 4.2);
        const on = hoverRef.current === u.key, dim = hoverRef.current && !on;
        m.scale.setScalar(Math.max(s * (on ? 1.04 : 1), 0.001));
        m.position.copy(u.centre).multiplyScalar(1 + spread + (on ? 0.08 : 0));
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity += ((on ? 0.45 : 0.08) - mat.emissiveIntensity) * Math.min(dt * 10, 1);
        mat.opacity += ((dim ? 0.25 : (m.userData as { fixed?: boolean }).fixed ? 0.95 : 0.82) - mat.opacity) * Math.min(dt * 10, 1);
      }
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(blocks, false)[0];
      const k = hit ? (hit.object.userData as { key: string }).key : null;
      if (k !== lastHit && !dragging) { lastHit = k; setHover(k); }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    frame();
    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize); ro.observe(el);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      for (const m of blocks) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
      renderer.dispose(); el.removeChild(renderer.domElement);
    };
  }, [items, motion]);

  const shown = items.find((x) => x.key === hover);
  if (!items.length) return null;
  return (
    <section className="pf-card pf-cube" aria-label={t("Spend cube")}>
      <div className="pf-clk-head">
        <div>
          <h2 className="pf-section-title" style={{ margin: 0 }}>{t("Spend cube")}</h2>
          <p>{t("All your spending as one cube: each category a block as big as its share. Drag to turn it, point at a block to read it.")}</p>
        </div>
        <Segmented size="sm" label={t("Blocks")} value={apart} onChange={setApart} options={[{ value: "together", label: t("Together") }, { value: "apart", label: t("Apart") }]} />
      </div>
      <div className="pf-cube-body">
        <div ref={mount} className="pf-cube-stage" />
        <div className="pf-cube-side">
          <div className="pf-cube-readout" style={{ ["--c" as string]: shown?.color ?? "#fff" }}>
            <span>{shown ? shown.name : mode === "month" ? t("Spent this month") : t("Spent this year")}</span>
            <b className="pf-rounded">{money(shown ? shown.amount : total, currency)}</b>
            <small>{shown ? `${t("{pct}% of spending", { pct: Math.round((shown.amount / total) * 100) })} · ${shown.fixed ? t("Fixed") : t("Variable")}` : t("{n} categories", { n: items.length })}</small>
          </div>
          <ul className="pf-cube-list">
            {items.map((x) => (
              <li key={x.key} data-on={hover === x.key || undefined} onPointerEnter={() => setHover(x.key)} onPointerLeave={() => setHover(null)}>
                <i style={{ background: x.color, opacity: x.fixed ? 1 : 0.75 }} />
                <span>{x.name}</span>
                <b className="pf-rounded">{Math.round((x.amount / total) * 100)}%</b>
              </li>
            ))}
          </ul>
          <small className="pf-cube-key">{t("Solid: fixed costs, at the bottom · glassy: variable")}</small>
        </div>
      </div>
    </section>
  );
}
