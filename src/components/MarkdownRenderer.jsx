import React, { useMemo } from "react";
import md from "markdown-it";
import tm from "markdown-it-texmath";
import katex from "katex";
import "katex/dist/katex.min.css";
import "katex/dist/contrib/mhchem";

// Create a markdown-it instance
const markdownRenderer = md({
  html: true,
  linkify: true,
  typographer: false,
}).use(tm, {
  engine: katex,
  delimiters: "dollars",
  katexOptions: {
    trust: true,
    strict: false,
    throwOnError: false,
    output: "html",
  },
});

export default function MarkdownRenderer({ content, className }) {
  // Use useMemo to re-render only when content changes
  const renderedContent = useMemo(() => {
    return markdownRenderer.render(content || "_No content_");
  }, [content]);

  return (
    <div
      className={`markdown-preview ${className || ""}`}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  );
}
