import { useCallback } from "react";

type ListUpdater<T> = T[] | ((prev: T[]) => T[]);

export interface OrderedListOptions<T> {
  normalize?: (items: T[]) => T[];
}

export function useOrderedList<T>(
  items: T[],
  setItems: React.Dispatch<React.SetStateAction<T[]>>,
  options: OrderedListOptions<T> = {},
) {
  const normalize = useCallback(
    (next: T[]) => (options.normalize ? options.normalize(next) : next),
    [options.normalize],
  );

  const applyUpdate = useCallback(
    (updater: ListUpdater<T>) => {
      setItems((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (prev: T[]) => T[])(prev)
            : updater;
        return normalize(next);
      });
    },
    [setItems, normalize],
  );

  const updateItem = useCallback(
    (index: number, itemOrUpdater: T | ((prev: T) => T)) => {
      applyUpdate((prev) => {
        if (index < 0 || index >= prev.length) return prev;
        const next = [...prev];
        const nextItem =
          typeof itemOrUpdater === "function"
            ? (itemOrUpdater as (prev: T) => T)(prev[index])
            : itemOrUpdater;
        next[index] = nextItem;
        return next;
      });
    },
    [applyUpdate],
  );

  const addItem = useCallback(
    (itemOrFactory: T | ((prev: T[]) => T)) => {
      applyUpdate((prev) => [
        ...prev,
        typeof itemOrFactory === "function"
          ? (itemOrFactory as (prev: T[]) => T)(prev)
          : itemOrFactory,
      ]);
    },
    [applyUpdate],
  );

  const removeItem = useCallback(
    (index: number) => {
      applyUpdate((prev) => prev.filter((_, i) => i !== index));
    },
    [applyUpdate],
  );

  const moveItem = useCallback(
    (fromIndex: number, toIndex: number) => {
      applyUpdate((prev) => {
        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= prev.length ||
          toIndex >= prev.length
        ) {
          return prev;
        }
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
    },
    [applyUpdate],
  );

  const moveItemUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      moveItem(index, index - 1);
    },
    [moveItem],
  );

  const moveItemDown = useCallback(
    (index: number) => {
      moveItem(index, index + 1);
    },
    [moveItem],
  );

  return {
    items,
    setItems: applyUpdate,
    updateItem,
    addItem,
    removeItem,
    moveItem,
    moveItemUp,
    moveItemDown,
  };
}
