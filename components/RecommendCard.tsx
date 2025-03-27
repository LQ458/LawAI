import { Card } from "primereact/card";
import { Tag } from "primereact/tag";

interface RecommendCardProps {
  item: any;
  type: "record" | "article";
}

export const RecommendCard = ({ item, type }: RecommendCardProps) => {
  const header = (
    <div className="flex justify-between items-center">
      <h3 className="text-lg font-semibold">{item.title}</h3>
      {type === "article" && (
        <Tag value={item.author} severity="info" rounded />
      )}
    </div>
  );

  const footer = (
    <div className="flex justify-between items-center mt-4">
      <div className="flex gap-2">
        <i className="pi pi-eye" /> {item.views}
        <i className="pi pi-heart-fill" /> {item.likes}
      </div>
      {type === "article" && (
        <span className="text-sm text-gray-500">
          发布于 {new Date(item.publishDate).toLocaleDateString()}
        </span>
      )}
    </div>
  );

  return (
    <Card header={header} footer={footer} className="h-full flex flex-col">
      <div className="flex-1 flex flex-col">
        <p className="line-clamp-3 flex-1">{item.description}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          {item.tags.map((tag: string) => (
            <Tag key={tag} value={tag} severity="secondary" rounded />
          ))}
        </div>
      </div>
    </Card>
  );
};
