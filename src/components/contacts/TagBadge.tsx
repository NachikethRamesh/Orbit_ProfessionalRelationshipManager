"use client";

/**
 * TagBadge — A small pill-shaped badge that displays a contact tag.
 *
 * Optionally includes a remove (X) button when an onRemove callback is provided.
 * Used in ContactCard and contact detail views to show and manage tags.
 */

interface TagBadgeProps {
  /** The tag text to display (e.g., "investor", "friend", "colleague") */
  tag: string;
  /** If provided, renders an X button that calls this when clicked */
  onRemove?: () => void;
}

export default function TagBadge({ tag, onRemove }: TagBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
      {/* Tag label */}
      {tag}

      {/* Conditionally render the remove button only when onRemove is provided */}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 hover:text-blue-600 focus:outline-none"
          aria-label={`Remove tag: ${tag}`}
        >
          &times;
        </button>
      )}
    </span>
  );
}
