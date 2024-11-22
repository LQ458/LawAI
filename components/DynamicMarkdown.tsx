import dynamic from "next/dynamic";

const DynamicMarkdownRenderer = dynamic(
  async () => await import("./MarkdownRenderer"),
  {
    loading: () => <i className="pi pi-spin pi-spinner text-gray-400 font-thin" style={{ fontSize: '3rem' }}></i>,
  },
);

export default DynamicMarkdownRenderer;
