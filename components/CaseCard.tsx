import { FC, useState } from "react";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { Case } from "@/types";
import { Toast } from "primereact/toast";
import { useRef } from "react";

interface CaseCardProps {
  caseData: Case;
  onLike: () => void;
  onBookmark: () => void;
  isAuthenticated: boolean;
  isLiked?: boolean;
  isBookmarked?: boolean;
}

export const CaseCard: FC<CaseCardProps> = ({
  caseData,
  onLike,
  onBookmark,
  isAuthenticated,
  isLiked = false,
  isBookmarked = false,
}) => {
  const [liked, setLiked] = useState(isLiked);
  const [bookmarked, setBookmarked] = useState(isBookmarked);
  const [likeCount, setLikeCount] = useState(caseData.likes);
  const [bookmarkCount, setBookmarkCount] = useState(caseData.bookmarks);
  const toast = useRef<Toast>(null);

  const handleLike = async () => {
    if (!isAuthenticated) {
      toast.current?.show({
        severity: "warn",
        summary: "请先登录",
        detail: "登录后即可点赞",
        life: 3000,
      });
      return;
    }

    try {
      const response = await fetch("/api/cases/like", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ caseId: caseData.id }),
      });

      if (!response.ok) throw new Error("Failed to like case");

      const { liked } = await response.json();
      setLiked(liked);
      setLikeCount((prev) => (liked ? prev + 1 : prev - 1));
      onLike();
    } catch (error) {
      console.error("Error liking case:", error);
      toast.current?.show({
        severity: "error",
        summary: "操作失败",
        detail: "请稍后重试",
        life: 3000,
      });
    }
  };

  const handleBookmark = async () => {
    if (!isAuthenticated) {
      toast.current?.show({
        severity: "warn",
        summary: "请先登录",
        detail: "登录后即可收藏",
        life: 3000,
      });
      return;
    }

    try {
      const response = await fetch("/api/cases/bookmark", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ caseId: caseData.id }),
      });

      if (!response.ok) throw new Error("Failed to bookmark case");

      const { bookmarked } = await response.json();
      setBookmarked(bookmarked);
      setBookmarkCount((prev) => (bookmarked ? prev + 1 : prev - 1));
      onBookmark();
    } catch (error) {
      console.error("Error bookmarking case:", error);
      toast.current?.show({
        severity: "error",
        summary: "操作失败",
        detail: "请稍后重试",
        life: 3000,
      });
    }
  };

  const footer = (
    <div className="flex justify-between items-center">
      <div className="flex gap-2">
        <Button
          icon={`pi pi-heart${liked ? "-fill" : ""}`}
          className={liked ? "p-button-danger" : "p-button-secondary"}
          text
          onClick={handleLike}
          tooltip={isAuthenticated ? "点赞" : "请先登录"}
          badge={likeCount.toString()}
        />
        <Button
          icon={`pi pi-bookmark${bookmarked ? "-fill" : ""}`}
          className={bookmarked ? "p-button-warning" : "p-button-secondary"}
          text
          onClick={handleBookmark}
          tooltip={isAuthenticated ? "收藏" : "请先登录"}
          badge={bookmarkCount.toString()}
        />
      </div>
      <span className="text-sm text-gray-500">
        {new Date(caseData.createdAt).toLocaleDateString()}
      </span>
    </div>
  );

  return (
    <>
      <Toast ref={toast} />
      <Card
        title={caseData.title}
        subTitle={
          <div className="flex gap-2 mt-2">
            {caseData.tags.map((tag) => (
              <Tag key={tag} value={tag} />
            ))}
          </div>
        }
        footer={footer}
        className="hover:shadow-lg transition-shadow"
      >
        <p className="line-clamp-3">{caseData.summary}</p>
      </Card>
    </>
  );
};
