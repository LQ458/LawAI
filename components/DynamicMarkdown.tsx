import dynamic from 'next/dynamic';

const DynamicMarkdownRenderer = dynamic(async() => await import('./MarkdownRenderer'), {
  loading: () => <div>加载中...</div>,
  ssr: false
});

export default DynamicMarkdownRenderer; 