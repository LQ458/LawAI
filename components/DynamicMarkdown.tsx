import dynamic from "next/dynamic";

const DynamicMarkdownRenderer = dynamic(
  async () => await import("./MarkdownRenderer"),
  {
    loading: () => (
      <div className="flex justify-center items-center p-4">
        <i
          className="pi pi-spin pi-spinner text-purple-400"
          style={{ fontSize: "1.5rem" }}
        ></i>
        <span className="ml-2 text-gray-500">加载中...</span>
      </div>
    ),
  },
);

export default DynamicMarkdownRenderer;
