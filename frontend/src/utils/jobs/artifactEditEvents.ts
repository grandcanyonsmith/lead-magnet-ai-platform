export const ARTIFACT_EDIT_COMPLETED_EVENT =
  "lead-magnet:artifact-edit-completed";

export interface ArtifactEditCompletedDetail {
  editId: string;
  artifactId: string;
  jobId?: string | null;
}

export function dispatchArtifactEditCompleted(
  detail: ArtifactEditCompletedDetail,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ArtifactEditCompletedDetail>(
      ARTIFACT_EDIT_COMPLETED_EVENT,
      { detail },
    ),
  );
}

export function subscribeToArtifactEditCompleted(
  callback: (detail: ArtifactEditCompletedDetail) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const listener = (event: Event) => {
    callback((event as CustomEvent<ArtifactEditCompletedDetail>).detail);
  };

  window.addEventListener(ARTIFACT_EDIT_COMPLETED_EVENT, listener);
  return () => {
    window.removeEventListener(ARTIFACT_EDIT_COMPLETED_EVENT, listener);
  };
}
