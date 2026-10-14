import type { MDXComponents } from "mdx/types";
import { ProjectName, SupportEmail } from "@/components/legal/mdx";

const components: MDXComponents = {
  h2: (props) => (
    <h2
      className="mt-10 mb-3 font-display text-xl font-semibold text-foreground first:mt-0"
      {...props}
    />
  ),
  p: (props) => <p className="mb-4 text-pretty text-muted-foreground" {...props} />,
  ul: (props) => (
    <ul
      className="mb-4 list-disc space-y-2 pl-5 text-muted-foreground marker:text-primary-text"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="mb-4 list-decimal space-y-2 pl-5 text-muted-foreground marker:text-primary-text"
      {...props}
    />
  ),
  code: (props) => (
    <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground" {...props} />
  ),
  a: (props) => (
    <a className="font-medium text-primary-text underline underline-offset-4" {...props} />
  ),
  // Post images live in public/blog/<slug>/. They sit below the opening
  // paragraph, so they load lazily.
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  img: (props) => <img loading="lazy" decoding="async" className="my-6 h-auto w-full rounded-xl border" {...props} />,
  strong: (props) => <strong className="font-semibold text-foreground" {...props} />,
  // Templates open with "_Last updated: …_"; show it as metadata, not italics.
  em: (props) => <em className="text-sm not-italic text-muted-foreground" {...props} />,
  ProjectName,
  SupportEmail,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
