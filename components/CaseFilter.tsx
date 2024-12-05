import { FC } from "react";
import { Dropdown } from "primereact/dropdown";
import { MultiSelect } from "primereact/multiselect";
import { SortOption } from "@/types";

interface CaseFilterProps {
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
  filterTags: string[];
  onFilterChange: (tags: string[]) => void;
}

const sortOptions = [
  { label: "最新", value: "latest" },
  { label: "最热", value: "popular" },
  { label: "最多点赞", value: "mostLiked" },
];

const tagOptions = [
  { label: "民事", value: "civil" },
  { label: "刑事", value: "criminal" },
  { label: "商业", value: "business" },
  // ... 更多标签选项
];

export const CaseFilter: FC<CaseFilterProps> = ({
  sortOption,
  onSortChange,
  filterTags,
  onFilterChange,
}) => {
  return (
    <div className="flex gap-4">
      <Dropdown
        value={sortOption}
        options={sortOptions}
        onChange={(e) => onSortChange(e.value)}
        placeholder="排序方式"
      />
      <MultiSelect
        value={filterTags}
        options={tagOptions}
        onChange={(e) => onFilterChange(e.value)}
        placeholder="选择标签"
        maxSelectedLabels={3}
      />
    </div>
  );
};
