import React, { useMemo, useRef, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github.css";

// 类型定义
interface MarkdownProps {
  content: string;
  loading?: boolean;
  fontSize?: number;
  fontFamily?: string;
}

interface CustomCodeProps {
  children: React.ReactNode;
  className?: string;
  enableCodeFold?: boolean;
}

// 复制到剪贴板的工具函数
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    // 可以添加复制成功的提示
  } catch (err) {
    console.error('复制失败:', err);
  }
};

// 自定义代码块组件
const CustomCode: React.FC<CustomCodeProps> = ({ 
  children, 
  className,
  enableCodeFold = true 
}) => {
  const ref = useRef<HTMLPreElement>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [showToggle, setShowToggle] = useState(false);

  useEffect(() => {
    if (ref.current) {
      const codeHeight = ref.current.scrollHeight;
      setShowToggle(codeHeight > 400);
    }
  }, [children]);

  return (
    <div className="code-wrapper">
      <code
        className={className}
        ref={ref}
        style={{
          maxHeight: enableCodeFold && collapsed ? "400px" : "none",
          overflow: "hidden",
        }}
      >
        {children}
      </code>
      
      {enableCodeFold && showToggle && (
        <div className={`show-more-button ${collapsed ? "collapsed" : "expanded"}`}>
          <button onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? "显示更多" : "收起"}
          </button>
        </div>
      )}
    </div>
  );
};

// 自定义代码块容器组件
const PreCode: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = useRef<HTMLPreElement>(null);

  return (
    <pre ref={ref}>
      <span
        className="copy-code-button"
        onClick={() => {
          if (ref.current) {
            copyToClipboard(ref.current.querySelector("code")?.innerText ?? "");
          }
        }}
      >
        复制
      </span>
      {children}
    </pre>
  );
};

// 自定义链接组件
const CustomLink: React.FC<{ 
  href?: string; 
  children: React.ReactNode;
  target?: string;
}> = ({ href = "", children, ...props }) => {
  // 处理多媒体链接
  if (/\.(mp3|wav|aac|opus)$/.test(href)) {
    return (
      <figure>
        <audio controls src={href} />
      </figure>
    );
  }
  
  if (/\.(mp4|webm|ogv|avi|mpeg)$/.test(href)) {
    return (
      <video controls width="99.9%">
        <source src={href} />
      </video>
    );
  }

  const isInternal = /^\/#/i.test(href);
  const target = isInternal ? "_self" : props.target ?? "_blank";
  
  return <a {...props} href={href} target={target}>{children}</a>;
};

// 辅助函数：转义特殊字符
const escapeBrackets = (text: string): string => {
  const pattern = /(```[\s\S]*?```|`.*?`)|\\\[([\s\S]*?[^\\])\\\]|\\\((.*?)\\\)/g;
  return text.replace(pattern, (match, codeBlock, squareBracket, roundBracket) => {
    if (codeBlock) return codeBlock;
    if (squareBracket) return `$$${squareBracket}$$`;
    if (roundBracket) return `$${roundBracket}$`;
    return match;
  });
};

// 辅助函数：HTML代码包装
const tryWrapHtmlCode = (text: string): string => {
  return text
    .replace(
      /([`]*?)(\w*?)([\n\r]*?)(<!DOCTYPE html>)/g,
      (match, quoteStart, lang, newLine, doctype) => {
        return !quoteStart ? "\n```html\n" + doctype : match;
      }
    )
    .replace(
      /(<\/body>)([\r\n\s]*?)(<\/html>)([\n\r]*)([`]*)([\n\r]*?)/g,
      (match, bodyEnd, space, htmlEnd, newLine, quoteEnd) => {
        return !quoteEnd ? bodyEnd + space + htmlEnd + "\n```\n" : match;
      }
    );
};

// 主组件
const MarkdownRenderer: React.FC<MarkdownProps> = ({
  content,
  loading,
  fontSize = 16,
  fontFamily = "inherit",
}) => {
  const mdRef = useRef<HTMLDivElement>(null);

  // 处理内容
  const escapedContent = useMemo(() => {
    return tryWrapHtmlCode(escapeBrackets(content));
  }, [content]);

  return (
    <div
      className="markdown-body"
      style={{
        fontSize: `${fontSize}px`,
        fontFamily: fontFamily,
      }}
      ref={mdRef}
      dir="auto"
    >
      {loading ? (
        <div className="loading">加载中...</div>
      ) : (
        <ReactMarkdown
          remarkPlugins={[remarkMath, remarkGfm, remarkBreaks]}
          rehypePlugins={[
            rehypeKatex,
            [rehypeHighlight, { detect: false, ignoreMissing: true }]
          ]}
          components={{
            pre: PreCode,
            code: CustomCode,
            a: CustomLink
          }}
        >
          {escapedContent}
        </ReactMarkdown>
      )}
    </div>
  );
};

export default MarkdownRenderer;
