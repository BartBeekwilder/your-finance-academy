"use client";

import type { ReactNode } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripHorizontal } from "lucide-react";
import { setOrder, useOrder } from "@/lib/prefs";

// A page's tiles the user can rearrange. Tiles are full of their own
// controls (sliders, inputs, charts), so a tile moves by its grip: a small
// handle on the top edge that shows on hover (mouse, touch after a short
// press, or keyboard: focus, Space, arrows, Space). The lifted tile follows
// the pointer, the others glide out of the way, and the order is kept per
// browser under `storageKey`.

export default function SortableTiles({ storageKey, tiles, gap = 24 }: { storageKey: string; tiles: { id: string; label: string; node: ReactNode }[]; gap?: number }) {
  const order = useOrder(
    storageKey,
    tiles.map((t) => t.id),
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const byId = new Map(tiles.map((t) => [t.id, t]));

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    setOrder(storageKey, arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id))));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div style={{ display: "grid", gap }}>
          {order.map((id) => {
            const t = byId.get(id);
            return t ? <Tile key={id} id={id} label={t.label}>{t.node}</Tile> : null;
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function Tile({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: { duration: 340, easing: "cubic-bezier(0.34, 1.3, 0.64, 1)" },
  });
  return (
    <div
      ref={setNodeRef}
      className="pf-tile"
      data-dragging={isDragging}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <button ref={setActivatorNodeRef} type="button" className="pf-tile-grip" aria-label={`Move ${label}`} {...attributes} {...listeners}>
        <GripHorizontal size={14} />
      </button>
      {children}
    </div>
  );
}
