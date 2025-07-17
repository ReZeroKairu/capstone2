import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const SortableItem = ({ field, updateField }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="mb-4 border p-4 rounded-lg"
    >
      <div className="flex justify-between items-center">
        <input
          value={field.label}
          onChange={(e) => updateField(field.id, "label", e.target.value)}
          className="flex-1 p-2 border rounded-lg"
          placeholder="Field Label"
        />
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => updateField(field.id, "required", e.target.checked)}
          className="ml-2"
        />
        <span className="ml-2 text-sm">Required</span>
      </div>
    </div>
  );
};
