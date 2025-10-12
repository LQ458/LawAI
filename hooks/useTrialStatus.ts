import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface TrialStatus {
  trialChatsUsed: number;
  trialChatsLimit: number;
  isPremium: boolean;
  remainingTrialChats: number;
}

export const useTrialStatus = () => {
  const { data: session } = useSession();
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrialStatus = async () => {
    if (!session?.user?.name) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/user-trial-status?username=${encodeURIComponent(session.user.name)}`);
      
      if (response.ok) {
        const data = await response.json();
        setTrialStatus(data);
      } else {
        setError("Failed to fetch trial status");
      }
    } catch (err) {
      setError("Error fetching trial status");
      console.error("Trial status fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrialStatus();
  }, [session?.user?.name]);

  return {
    trialStatus,
    loading,
    error,
    refetch: fetchTrialStatus,
  };
};