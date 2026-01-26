import { useState } from "react";
import { api } from "@/lib/api";
import { WorkflowIdeationDeliverable } from "@/types";

export function useMockupState() {
  const [mockupImages, setMockupImages] = useState<string[]>([]);
  const [isGeneratingMockups, setIsGeneratingMockups] = useState(false);
  const [mockupError, setMockupError] = useState<string | null>(null);

  const generateMockups = async (selectedDeliverable: WorkflowIdeationDeliverable) => {
    if (isGeneratingMockups) return;

    setIsGeneratingMockups(true);
    setMockupError(null);
    setMockupImages([]);

    try {
      const response = await api.generateDeliverableMockups({
        deliverable: {
          title: selectedDeliverable.title,
          description: selectedDeliverable.description,
          deliverable_type: selectedDeliverable.deliverable_type,
          build_description: selectedDeliverable.build_description,
        },
        count: 4,
      });

      const urls = (response.images || []).map((image) => image.url).filter(Boolean);
      if (urls.length === 0) {
        setMockupError("No mockups returned. Try again in a moment.");
        return;
      }
      setMockupImages(urls);
    } catch (err: any) {
      setMockupError(err.message || "Failed to generate mockups");
    } finally {
      setIsGeneratingMockups(false);
    }
  };

  const resetMockups = () => {
    setMockupImages([]);
    setMockupError(null);
    setIsGeneratingMockups(false);
  };

  return {
    mockupImages, setMockupImages,
    isGeneratingMockups, setIsGeneratingMockups,
    mockupError, setMockupError,
    generateMockups,
    resetMockups,
  };
}
