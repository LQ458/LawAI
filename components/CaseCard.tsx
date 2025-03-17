import { useState, useEffect } from "react";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { IRecordWithUserState } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Tooltip } from "primereact/tooltip";

interface CaseCardProps {
  record: IRecordWithUserState;
  onLike: () => void;
  onBookmark: () => void;
}

export default function CaseCard({
  record,
  onLike,
  onBookmark,
}: CaseCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const viewStartTime = Date.now();

    return () => {
      const duration = (Date.now() - viewStartTime) / 1000; // 转换为秒
      // 记录查看时长
      fetch("/api/user-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "view",
          recordId: record._id,
          duration,
        }),
      });
    };
  }, [record._id]);

  const header = (
    <div
      className={`relative h-40 bg-gradient-to-br from-blue-50 to-white transition-all duration-300 ${
        isHovered ? "shadow-md" : ""
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <h3 className="text-xl font-semibold text-gray-800 text-center line-clamp-2 hover:line-clamp-none transition-all duration-300">
          {record.title}
        </h3>
      </div>
    </div>
  );

  const formatDate = (dateString: string) => {
    try {
      if (dateString) {
        return formatDistanceToNow(new Date(dateString), {
          addSuffix: true,
          locale: zhCN,
        });
      }
      return formatDistanceToNow(new Date(record.lastUpdateTime), {
        addSuffix: true,
        locale: zhCN,
      });
    } catch (error) {
      console.error("Invalid date:", dateString, error);
      return "未知时间";
    }
  };

  const footer = (
    <div className="flex justify-between items-center pt-4">
      <div className="flex items-center space-x-4">
        <Button
          icon={`pi ${record.isLiked ? "pi-heart-fill" : "pi-heart"}`}
          className={`p-button-rounded p-button-text ${
            record.isLiked
              ? "text-red-500 hover:text-red-600"
              : "text-gray-500 hover:text-gray-600"
          }`}
          onClick={onLike}
          tooltip={`${record.likes} 赞`}
          tooltipOptions={{ position: "top" }}
        />
        <Button
          icon={`pi ${record.isBookmarked ? "pi-bookmark-fill" : "pi-bookmark"}`}
          className={`p-button-rounded p-button-text ${
            record.isBookmarked
              ? "text-blue-500 hover:text-blue-600"
              : "text-gray-500 hover:text-gray-600"
          }`}
          onClick={onBookmark}
          tooltip={record.isBookmarked ? "取消收藏" : "收藏"}
          tooltipOptions={{ position: "top" }}
        />
      </div>
      <Tooltip target=".time-info" />
      <div
        className="time-info text-sm text-gray-500 cursor-help"
        data-pr-tooltip={
          record.date || new Date(record.lastUpdateTime).toLocaleString()
        }
      >
        {formatDate(record.date)}
      </div>
    </div>
  );

  return (
    <Card
      header={header}
      footer={footer}
      className="shadow-md hover:shadow-lg transition-all duration-300 bg-white"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {record.tags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-blue-50 text-blue-600 text-sm rounded-full hover:bg-blue-100 transition-colors duration-200"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="relative">
          <p className={`text-gray-600 ${!isExpanded && "line-clamp-3"}`}>
            {record.description}
          </p>
          {record.description.length > 150 && (
            <Button
              label={isExpanded ? "收起" : "展开"}
              className="p-button-text p-button-sm absolute bottom-0 right-0 bg-white"
              onClick={() => setIsExpanded(!isExpanded)}
            />
          )}
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500 pt-2 border-t">
          <span>浏览 {record.views}</span>
          <span className="text-blue-500">
            推荐指数 {(record.score || 0).toFixed(1)}
          </span>
        </div>
      </div>
    </Card>
  );
}
