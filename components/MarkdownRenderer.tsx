/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import RemarkMath from "remark-math";
import RemarkGfm from "remark-gfm";
import RemarkBreaks from "remark-breaks";
import RehypeKatex from "rehype-katex";
import RehypeHighlight from "rehype-highlight";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github.css";

// 类型定义
interface MarkdownProps {
  content: string;
  loading?: boolean;
  fontSize?: number;
  fontFamily?: string;
  onLoad?: () => void;
}

function escapeBrackets(text: string) {
  const pattern =
    /(```[\s\S]*?```|`.*?`)|\\\[([\s\S]*?[^\\])\\\]|\\\((.*?)\\\)/g;
  return text.replace(
    pattern,
    (match, codeBlock, squareBracket, roundBracket) => {
      if (codeBlock) {
        return codeBlock;
      } else if (squareBracket) {
        return `$$${squareBracket}$$`;
      } else if (roundBracket) {
        return `$${roundBracket}$`;
      }
      return match;
    },
  );
}

function tryWrapHtmlCode(text: string) {
  // try add wrap html code (fixed: html codeblock include 2 newline)
  return text
    .replace(
      /([`]*?)(\w*?)([\n\r]*?)(<!DOCTYPE html>)/g,
      (match, quoteStart, lang, newLine, doctype) => {
        return !quoteStart ? "\n```html\n" + doctype : match;
      },
    )
    .replace(
      /(<\/body>)([\r\n\s]*?)(<\/html>)([\n\r]*)([`]*)([\n\r]*?)/g,
      (match, bodyEnd, space, htmlEnd, newLine, quoteEnd) => {
        return !quoteEnd ? bodyEnd + space + htmlEnd + "\n```\n" : match;
      },
    );
}

const RenderedContent = (props: { content: string }) => {
  const escapedContent = useMemo(() => {
    return tryWrapHtmlCode(escapeBrackets(props.content));
  }, [props.content]);

  return (
    <ReactMarkdown
      remarkPlugins={[RemarkMath, RemarkGfm, RemarkBreaks]}
      rehypePlugins={[
        RehypeKatex,
        [
          RehypeHighlight,
          {
            detect: false,
            ignoreMissing: true,
          },
        ],
      ]}
      components={{
        p: (pProps) => <p {...pProps} dir="auto" />,
        a: (aProps) => {
          const href = aProps.href || "";
          if (/\.(aac|mp3|opus|wav)$/.test(href)) {
            return (
              <figure>
                <audio controls src={href}></audio>
              </figure>
            );
          }
          if (/\.(3gp|3g2|webm|ogv|mpeg|mp4|avi)$/.test(href)) {
            return (
              <video controls width="99.9%">
                <source src={href} />
              </video>
            );
          }
          const isInternal = /^\/#/i.test(href);
          const target = isInternal ? "_self" : (aProps.target ?? "_blank");
          return <a {...aProps} target={target} />;
        },
      }}
    >
      {escapedContent}
    </ReactMarkdown>
  );
};

// 主组件
const MarkdownRenderer: React.FC<MarkdownProps> = (props) => {
  const mdRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    props.onLoad?.();
  }, [props.onLoad]);

  return (
    <div
      className="markdown-body"
      style={{
        fontSize: `${props.fontSize}px`,
        fontFamily: props.fontFamily,
      }}
      ref={mdRef}
      dir="auto"
    >
      {props.loading ? (
        <i
          className="pi pi-spin pi-spinner text-gray-400 font-thin"
          style={{ fontSize: "3rem" }}
        ></i>
      ) : (
        <RenderedContent content={props.content} />
      )}
    </div>
  );
};

export default MarkdownRenderer;
