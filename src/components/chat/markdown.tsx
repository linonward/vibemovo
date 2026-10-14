import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Chat replies are Markdown with GitHub extensions (tables, task lists,
// strikethrough). Raw HTML in a reply shows as text, never as markup, and
// react-markdown drops unsafe link URLs such as javascript:.
const components: Components = {
  p: (props) => <p className="my-3 first:mt-0 last:mb-0" {...props} />,
  h1: (props) => <h3 className="mt-5 mb-2 text-lg font-semibold first:mt-0" {...props} />,
  h2: (props) => <h3 className="mt-5 mb-2 text-base font-semibold first:mt-0" {...props} />,
  h3: (props) => <h4 className="mt-4 mb-2 font-semibold first:mt-0" {...props} />,
  ul: (props) => <ul className="my-3 list-disc space-y-1 pl-5 first:mt-0 last:mb-0" {...props} />,
  ol: (props) => (
    <ol className="my-3 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0" {...props} />
  ),
  blockquote: (props) => (
    <blockquote className="my-3 border-l-2 pl-3 text-muted-foreground" {...props} />
  ),
  a: (props) => (
    <a
      className="font-medium text-primary-text underline underline-offset-4"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  // Fenced blocks: the <pre> scrolls sideways so long lines don't widen the bubble.
  pre: (props) => (
    <pre
      className="my-3 overflow-x-auto rounded-lg bg-muted px-4 py-3 font-mono text-[13px] leading-6 first:mt-0 last:mb-0 [&>code]:bg-transparent [&>code]:p-0"
      {...props}
    />
  ),
  code: (props) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]" {...props} />
  ),
  table: (props) => (
    <div className="my-3 overflow-x-auto first:mt-0 last:mb-0">
      <table className="w-full text-left text-sm" {...props} />
    </div>
  ),
  th: (props) => <th className="border-b px-3 py-1.5 font-semibold" {...props} />,
  td: (props) => <td className="border-b px-3 py-1.5" {...props} />,
  hr: (props) => <hr className="my-4" {...props} />,
};

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
