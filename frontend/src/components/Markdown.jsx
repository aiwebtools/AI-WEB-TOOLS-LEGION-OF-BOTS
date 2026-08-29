import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";
import "highlight.js/styles/github-dark.css";

function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);
  const text = String(children);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group">
      <button
        onClick={copy}
        data-testid="copy-code-btn"
        className="absolute right-2 top-2 z-10 p-1.5 bg-black/70 border border-border rounded-sm opacity-0 group-hover:opacity-100 transition-opacity text-matrix hover:bg-matrix hover:text-black"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      <pre className={className}>{children}</pre>
    </div>
  );
}

export default function Markdown({ content }) {
  return (
    <div className="md text-[0.95rem] text-foreground/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre: ({ node, children, ...props }) => <CodeBlock {...props}>{children.props?.children || children}</CodeBlock>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
