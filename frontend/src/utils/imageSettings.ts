import { DEFAULT_IMAGE_SETTINGS } from "@/constants/settingsDefaults";
import type { ImageGenerationSettings } from "@/types/workflow";

const VALID_SIZES = new Set(["1024x1024", "1024x1536", "1536x1024", "auto"]);
const VALID_QUALITIES = new Set(["low", "medium", "high", "auto"]);
const VALID_FORMATS = new Set(["png", "jpeg", "webp"]);
const VALID_BACKGROUNDS = new Set(["transparent", "opaque", "auto"]);
const VALID_FIDELITIES = new Set(["low", "high"]);

export type ResolvedImageSettings = ImageGenerationSettings & {
  model: NonNullable<ImageGenerationSettings["model"]>;
  size: NonNullable<ImageGenerationSettings["size"]>;
  quality: NonNullable<ImageGenerationSettings["quality"]>;
  background: NonNullable<ImageGenerationSettings["background"]>;
};

export const resolveImageSettingsDefaults = (
  settings?: ImageGenerationSettings | null,
): ResolvedImageSettings => {
  const rawModel =
    typeof settings?.model === "string" && settings.model.trim()
      ? settings.model.trim()
      : undefined;
  const model = rawModel || DEFAULT_IMAGE_SETTINGS.model || "gpt-image-1.5";

  const size = VALID_SIZES.has(settings?.size ?? "")
    ? (settings?.size as ResolvedImageSettings["size"])
    : (DEFAULT_IMAGE_SETTINGS.size || "auto");

  const quality = VALID_QUALITIES.has(settings?.quality ?? "")
    ? (settings?.quality as ResolvedImageSettings["quality"])
    : (DEFAULT_IMAGE_SETTINGS.quality || "auto");

  const background = VALID_BACKGROUNDS.has(settings?.background ?? "")
    ? (settings?.background as ResolvedImageSettings["background"])
    : (DEFAULT_IMAGE_SETTINGS.background || "auto");

  const format = VALID_FORMATS.has(settings?.format ?? "")
    ? (settings?.format as ResolvedImageSettings["format"])
    : undefined;

  const supportsCompression = format === "jpeg" || format === "webp";
  const rawCompression = settings?.compression;
  const compression =
    supportsCompression && typeof rawCompression === "number" && Number.isFinite(rawCompression)
      ? Math.min(100, Math.max(0, rawCompression))
      : undefined;

  const input_fidelity = VALID_FIDELITIES.has(settings?.input_fidelity ?? "")
    ? (settings?.input_fidelity as ResolvedImageSettings["input_fidelity"])
    : undefined;

  return {
    model,
    size,
    quality,
    format,
    compression,
    background,
    input_fidelity,
  };
};
