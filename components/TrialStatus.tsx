"use client";
import React from "react";
import { Card } from "primereact/card";
import { ProgressBar } from "primereact/progressbar";
import { Badge } from "primereact/badge";
import { useTrialStatus } from "@/hooks/useTrialStatus";

const TrialStatus: React.FC = () => {
  const { trialStatus, loading } = useTrialStatus();

  if (loading || !trialStatus) {
    return (
      <Card className="mb-3 p-2">
        <div className="text-sm text-gray-600">加载中...</div>
      </Card>
    );
  }

  if (trialStatus.isPremium) {
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

  const usagePercentage = (trialStatus.trialChatsUsed / trialStatus.trialChatsLimit) * 100;
  const isNearLimit = usagePercentage >= 80;
  const isExceeded = trialStatus.trialChatsUsed >= trialStatus.trialChatsLimit;

  return (
    <Card className="mb-3 p-2">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            免费试用
          </span>
          <Badge 
            value={`${trialStatus.remainingTrialChats}次剩余`}
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
          已用 {trialStatus.trialChatsUsed} / {trialStatus.trialChatsLimit} 次
        </div>
        
        {isExceeded && (
          <div className="text-xs text-red-600 text-center mt-2">
            试用次数已用完，请升级到付费版本
          </div>
        )}
      </div>
    </Card>
  );
};

export default TrialStatus;