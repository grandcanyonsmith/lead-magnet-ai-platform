import React from "react";
import { FiTrash2, FiPlus } from "react-icons/fi";

interface KeyValueEditorProps {
  items: Record<string, string>;
  onChange: (items: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addButtonLabel?: string;
}

export function KeyValueEditor({
  items,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  addButtonLabel = "Add Item",
}: KeyValueEditorProps) {
  return (
    <div className="space-y-3">
      {Object.entries(items).map(([key, value], idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <input
            type="text"
            value={key}
            onChange={(e) => {
              const newItems = { ...items };
              delete newItems[key];
              newItems[e.target.value] = value;
              onChange(newItems);
            }}
            placeholder={keyPlaceholder}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => {
              const newItems = { ...items, [key]: e.target.value };
              onChange(newItems);
            }}
            placeholder={valuePlaceholder}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all"
          />
          <button
            type="button"
            onClick={() => {
              const newItems = { ...items };
              delete newItems[key];
              onChange(newItems);
            }}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Remove item"
          >
            <FiTrash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          const newItems = { ...items, "": "" };
          onChange(newItems);
        }}
        className="flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium px-1 py-0.5 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors w-fit"
      >
        <FiPlus className="w-3.5 h-3.5" />
        {addButtonLabel}
      </button>
    </div>
  );
}
