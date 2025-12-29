/**
 * Accessibility utilities
 */

/**
 * Generate a unique ID for form elements
 */
let idCounter = 0;
export function generateId(prefix: string = "id"): string {
  return `${prefix}-${++idCounter}`;
}

/**
 * Get ARIA label for form field
 */
export function getFieldLabel(
  label: string,
  required?: boolean,
  error?: string
): string {
  let ariaLabel = label;
  if (required) {
    ariaLabel += ", required";
  }
  if (error) {
    ariaLabel += `, ${error}`;
  }
  return ariaLabel;
}

/**
 * Get ARIA described by for form field with error
 */
export function getFieldDescribedBy(
  fieldId: string,
  errorId?: string,
  helpId?: string
): string | undefined {
  const ids = [errorId, helpId].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

/**
 * Keyboard event handlers
 */
export const keyboardHandlers = {
  /**
   * Handle Enter key press
   */
  onEnter: (callback: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      callback();
    }
  },

  /**
   * Handle Escape key press
   */
  onEscape: (callback: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      callback();
    }
  },

  /**
   * Handle Arrow key navigation
   */
  onArrow: (
    onUp?: () => void,
    onDown?: () => void,
    onLeft?: () => void,
    onRight?: () => void
  ) => (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        onUp?.();
        break;
      case "ArrowDown":
        e.preventDefault();
        onDown?.();
        break;
      case "ArrowLeft":
        e.preventDefault();
        onLeft?.();
        break;
      case "ArrowRight":
        e.preventDefault();
        onRight?.();
        break;
    }
  },
};

/**
 * Focus management utilities
 */
export const focus = {
  /**
   * Focus first focusable element in container
   */
  first: (container: HTMLElement | null) => {
    if (!container) return;

    const focusable = container.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement | null;

    focusable?.focus();
  },

  /**
   * Focus last focusable element in container
   */
  last: (container: HTMLElement | null) => {
    if (!container) return;

    const focusable = Array.from(
      container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ) as HTMLElement[];

    focusable[focusable.length - 1]?.focus();
  },

  /**
   * Trap focus within container
   */
  trap: (container: HTMLElement | null) => {
    if (!container) return () => {};

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusable = Array.from(
        container.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ) as HTMLElement[];

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement;

      if (e.shiftKey) {
        // Shift + Tab
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        // Tab
        if (active === last || !container.contains(active)) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("keydown", handleKeyDown);
    };
  },
};

