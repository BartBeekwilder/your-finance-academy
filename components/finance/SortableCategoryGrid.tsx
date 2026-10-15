"use client";

import { useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { live } from "@/lib/finance/calc";
import type { Category } from "@/lib/finance/types";
import CategoryCard from "./CategoryCard";
import { useFinance } from "./FinanceProvider";

// "Spending by Category" grid the user can rearrange: drag a card (mouse,
// touch after a short press, or keyboard: focus, Space, arrows, Space) and
// the others glide out of the way. The order is saved as the categories'
// sort_order — the same order iOS uses — so it syncs across devices.

export default function SortableCategoryGrid({ categories }: { categories: Category[] }) {
  const { data, reorderCategories } = useFinance();
  const [activeId, setActiveId] = useState<string | null>(null);
  // A drag ends with a pointerup over the card, which the browser turns into
  // a click; swallow that one click so dropping doesn't open the sheet.
  const justDragged = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = categories.map((c) => c.id);
  const active = categories.find((c) => c.id === activeId);

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    justDragged.current = true;
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    setTimeout(() => (justDragged.current = false), 0);
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    // New order of the visible cards…
    const moved = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    // …written back into the slots those cards hold in the full category
    // list, so categories without spending this month keep their place.
    const all = live(data.categories)
      .filter((c) => c.parent_id === null)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => c.id);
    const visible = new Set(ids);
    let k = 0;
    const full = all.map((id) => (visible.has(id) ? moved[k++] : id));
    reorderCategories(full).catch((err) => alert(`Couldn't save the new order: ${err.message}`));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div
          className="pf-grid-auto"
          onClickCapture={(e) => {
            if (justDragged.current) {
              e.stopPropagation();
              e.preventDefault();
            }
          }}
        >
          {categories.map((c) => (
            <SortableCard key={c.id} category={c} />
          ))}
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={{ duration: 280, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
        {active ? (
          <div className="pf-drag-lift">
            <CategoryCard category={active} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableCard({ category }: { category: Category }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    transition: { duration: 320, easing: "cubic-bezier(0.34, 1.3, 0.64, 1)" },
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription="Draggable category card"
      className="pf-sortable"
      data-dragging={isDragging}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <CategoryCard category={category} />
    </div>
  );
}
