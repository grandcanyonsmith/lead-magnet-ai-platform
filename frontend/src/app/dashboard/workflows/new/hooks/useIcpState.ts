import { useState, useMemo } from "react";
import { useSettings, useUpdateSettings } from "@/hooks/api/useSettings";
import { api } from "@/lib/api";
import { ICPProfile } from "@/types";

export function useIcpState() {
  const [selectedIcpProfileId, setSelectedIcpProfileId] = useState<string>("");
  const [icpProfileName, setIcpProfileName] = useState("");
  const [icpProfileError, setIcpProfileError] = useState<string | null>(null);
  const [isIcpResearching, setIsIcpResearching] = useState(false);
  const [icpResearchError, setIcpResearchError] = useState<string | null>(null);

  const { settings, refetch: refetchSettings } = useSettings();
  const { updateSettings } = useUpdateSettings();

  const icpProfiles = useMemo(() => 
    Array.isArray(settings?.icp_profiles) ? settings.icp_profiles : [], 
    [settings?.icp_profiles]
  );
  
  const selectedIcpProfile = useMemo(() => 
    icpProfiles.find((profile) => profile.id === selectedIcpProfileId),
    [icpProfiles, selectedIcpProfileId]
  );
  
  const selectedIcpResearchStatus = selectedIcpProfile?.research_status || 
    (selectedIcpProfile?.research_report ? "completed" : undefined);

  const runIcpResearch = async (profileId: string, force = false) => {
    const profile = icpProfiles.find((p) => p.id === profileId);
    if (!profile) return;

    if (!force && (profile.research_status === "completed" || profile.research_status === "pending")) {
      return;
    }

    setIsIcpResearching(true);
    setIcpResearchError(null);

    try {
      const updatedProfiles = icpProfiles.map((p) =>
        p.id === profileId ? { ...p, research_status: "pending" as const, research_error: undefined } : p
      );
      await updateSettings({ icp_profiles: updatedProfiles });

      const result = await api.settings.generateIcpResearch({ profile_id: profileId, force });

      const completedProfiles = icpProfiles.map((p) => (p.id === profileId ? result.profile : p));
      await updateSettings({ icp_profiles: completedProfiles });
      await refetchSettings();
    } catch (err: any) {
      setIcpResearchError(err.message || "Research failed");
      const failedProfiles = icpProfiles.map((p) =>
        p.id === profileId
          ? { ...p, research_status: "failed" as const, research_error: err.message || "Research failed" }
          : p
      );
      await updateSettings({ icp_profiles: failedProfiles });
    } finally {
      setIsIcpResearching(false);
    }
  };

  return {
    selectedIcpProfileId, setSelectedIcpProfileId,
    icpProfileName, setIcpProfileName,
    icpProfileError, setIcpProfileError,
    isIcpResearching, setIsIcpResearching,
    icpResearchError, setIcpResearchError,
    icpProfiles,
    selectedIcpProfile,
    selectedIcpResearchStatus,
    runIcpResearch,
    refetchSettings,
    updateSettings,
  };
}
