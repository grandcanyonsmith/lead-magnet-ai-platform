export type ComputerUseConfigState = {
  display_width: number;
  display_height: number;
  environment: "browser" | "mac" | "windows" | "ubuntu";
};

export type ImageGenerationConfigState = {
  model: string;
  size: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  quality: "low" | "medium" | "high" | "auto";
  format?: "png" | "jpeg" | "webp";
  compression?: number;
  background: "transparent" | "opaque" | "auto";
  input_fidelity?: "low" | "high";
};
