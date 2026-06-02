import type { CSSProperties, ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Masonry from 'react-masonry-css'

export interface SortableItemRenderProps {
  setNodeRef: (node: HTMLElement | null) => void
  dragHandleProps: Record<string, unknown>
  dragStyle: CSSProperties
  isDragging: boolean
}

export interface SortablePanelItem {
  id: string
  render: (drag: SortableItemRenderProps) => ReactNode
}

interface SortableSlotProps {
  item: SortablePanelItem
}

function SortableSlot({ item }: SortableSlotProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const dragStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <>
      {item.render({
        setNodeRef,
        dragHandleProps: { ...attributes, ...listeners },
        dragStyle,
        isDragging,
      })}
    </>
  )
}

interface SortablePanelGridProps {
  items: SortablePanelItem[]
  onOrderChange: (ids: string[]) => void
  breakpointCols: Record<string | number, number>
}

export function SortablePanelGrid({
  items,
  onOrderChange,
  breakpointCols,
}: SortablePanelGridProps) {
  // Require a small pointer movement before drag activates so clicks on the
  // header (e.g. TodoPanel's toggle button) still register normally.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = items.map(i => i.id)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    onOrderChange(arrayMove(ids, oldIndex, newIndex))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map(i => i.id)}
        strategy={rectSortingStrategy}
      >
        <Masonry
          breakpointCols={breakpointCols}
          className="masonry-grid"
          columnClassName="masonry-col"
        >
          {items.map(item => (
            <SortableSlot key={item.id} item={item} />
          ))}
        </Masonry>
      </SortableContext>
    </DndContext>
  )
}
