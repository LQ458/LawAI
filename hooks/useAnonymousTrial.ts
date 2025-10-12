import { useState, useEffect } from "react";

const ANONYMOUS_TRIAL_KEY = "anonymous_trial_usage";
const ANONYMOUS_TRIAL_LIMIT = 10;

interface AnonymousTrialData {
  usage: number;
  limit: number;
  remaining: number;
  hasExceeded: boolean;
}

export const useAnonymousTrial = () => {
  const [trialData, setTrialData] = useState<AnonymousTrialData>({
    usage: 0,
    limit: ANONYMOUS_TRIAL_LIMIT,
    remaining: ANONYMOUS_TRIAL_LIMIT,
    hasExceeded: false,
  });

  // Load trial data from localStorage
  useEffect(() => {
    const storedUsage = localStorage.getItem(ANONYMOUS_TRIAL_KEY);
    const usage = storedUsage ? parseInt(storedUsage, 10) : 0;
    const remaining = Math.max(0, ANONYMOUS_TRIAL_LIMIT - usage);
    const hasExceeded = usage >= ANONYMOUS_TRIAL_LIMIT;

    setTrialData({
      usage,
      limit: ANONYMOUS_TRIAL_LIMIT,
      remaining,
      hasExceeded,
    });
  }, []);

  // Increment usage
  const incrementUsage = () => {
    const newUsage = trialData.usage + 1;
    localStorage.setItem(ANONYMOUS_TRIAL_KEY, newUsage.toString());
    
    const remaining = Math.max(0, ANONYMOUS_TRIAL_LIMIT - newUsage);
    const hasExceeded = newUsage >= ANONYMOUS_TRIAL_LIMIT;

    setTrialData({
      usage: newUsage,
      limit: ANONYMOUS_TRIAL_LIMIT,
      remaining,
      hasExceeded,
    });
  };

  // Reset trial (useful for testing or if user authenticates)
  const resetTrial = () => {
    localStorage.removeItem(ANONYMOUS_TRIAL_KEY);
    setTrialData({
      usage: 0,
      limit: ANONYMOUS_TRIAL_LIMIT,
      remaining: ANONYMOUS_TRIAL_LIMIT,
      hasExceeded: false,
    });
  };

  return {
    trialData,
    incrementUsage,
    resetTrial,
  };
};