export const NOTIFICATIONS_REFRESH_EVENT = "lead-magnet:notifications-refresh";

export function dispatchNotificationsRefresh(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
}

export function subscribeToNotificationsRefresh(
  callback: () => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, callback);
  return () => {
    window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, callback);
  };
}
