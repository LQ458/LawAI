"use client";
import React from "react";
import { Card } from "primereact/card";
import { ProgressBar } from "primereact/progressbar";
import { Badge } from "primereact/badge";
import { useSession } from "next-auth/react";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useAnonymousTrial } from "@/hooks/useAnonymousTrial";

const TrialStatus: React.FC = () => {
  const { data: session } = useSession();
  const { trialStatus, loading } = useTrialStatus();
  const { trialData } = useAnonymousTrial();

  // Use anonymous trial data if not authenticated
  const isAuthenticated = !!session?.user;
  const currentTrialData = isAuthenticated ? trialStatus : trialData;

  if (isAuthenticated && (loading || !trialStatus)) {
    return (
      <Card className="mb-3 p-2">
        <div className="text-sm text-gray-600">加载中...</div>
      </Card>
    );
  }

  if (isAuthenticated && trialStatus?.isPremium) {
    return (
      <Card className="mb-3 p-2">
        <div className="flex items-center gap-2">
          <Badge 
            value="高级版" 
            severity="success" 
            className="text-xs"
          />
          <span className="text-sm text-gray-700">无限制聊天</span>
        </div>
      </Card>
    );
  }

  // Get the appropriate data based on authentication status
  const usage = isAuthenticated ? (trialStatus?.trialChatsUsed || 0) : currentTrialData.usage;
  const limit = isAuthenticated ? (trialStatus?.trialChatsLimit || 10) : currentTrialData.limit;
  const remaining = isAuthenticated ? (trialStatus?.remainingTrialChats || 0) : currentTrialData.remaining;

  const usagePercentage = (usage / limit) * 100;
  const isNearLimit = usagePercentage >= 80;
  const isExceeded = usage >= limit;

  return (
    <Card className="mb-3 p-2">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            {isAuthenticated ? "免费试用" : "匿名试用"}
          </span>
          <Badge 
            value={`${remaining}次剩余`}
            severity={isExceeded ? "danger" : isNearLimit ? "warning" : "info"}
            className="text-xs"
          />
        </div>
        
        <ProgressBar 
          value={usagePercentage}
          className="h-2"
          color={isExceeded ? "#dc2626" : isNearLimit ? "#f59e0b" : "#3b82f6"}
          showValue={false}
        />
        
        <div className="text-xs text-gray-600 text-center">
          已用 {usage} / {limit} 次
        </div>
        
        {isExceeded && (
          <div className="text-xs text-red-600 text-center mt-2">
            {isAuthenticated 
              ? "试用次数已用完，请升级到付费版本" 
              : "试用次数已用完，请登录或注册继续使用"
            }
          </div>
        )}
      </div>
    </Card>
  );
};

export default TrialStatus;