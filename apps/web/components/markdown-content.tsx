import Link from "next/link";

type Block =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; code: string };

export function MarkdownContent({ content }: { content: string }) {
  const blocks = parseMarkdown(content);

  return (
    <div className="prose prose-slate max-w-none">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading": {
            const Heading = block.level === 2 ? "h2" : "h3";
            return (
              <Heading
                key={index}
                className="mt-8 text-2xl font-semibold tracking-normal first:mt-0"
              >
                <InlineMarkdown text={block.text} />
              </Heading>
            );
          }
          case "quote":
            return (
              <blockquote
                key={index}
                className="my-5 border-l-4 border-primary/40 bg-secondary/30 px-4 py-3 text-muted-foreground"
              >
                <InlineMarkdown text={block.text} />
              </blockquote>
            );
          case "list":
            return (
              <ul key={index} className="my-5 grid gap-2 pl-5">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="list-disc leading-7">
                    <InlineMarkdown text={item} />
                  </li>
                ))}
              </ul>
            );
          case "code":
            return (
              <pre
                key={index}
                className="my-5 overflow-x-auto rounded-md bg-slate-950 p-4 text-sm text-slate-100"
              >
                <code>{block.code}</code>
              </pre>
            );
          case "paragraph":
          default:
            return (
              <p key={index} className="my-5 leading-8 text-slate-700">
                <InlineMarkdown text={block.text} />
              </p>
            );
        }
      })}
    </div>
  );
}

function parseMarkdown(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: string[] = [];
  let code: string[] | null = null;

  function flushParagraph() {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  }

  function flushList() {
    if (list.length) {
      blocks.push({ type: "list", items: list });
      list = [];
    }
  }

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (code) {
        blocks.push({ type: "code", code: code.join("\n") });
        code = null;
      } else {
        flushParagraph();
        flushList();
        code = [];
      }
      continue;
    }

    if (code) {
      code.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: 3, text: trimmed.slice(4) });
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: 2, text: trimmed.slice(3) });
      continue;
    }

    if (trimmed.startsWith("> ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "quote", text: trimmed.slice(2) });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      list.push(trimmed.replace(/^[-*]\s+/, ""));
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  if (code) blocks.push({ type: "code", code: code.join("\n") });
  return blocks;
}

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={index} className="rounded bg-secondary px-1 py-0.5">
              {part.slice(1, -1)}
            </code>
          );
        }
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          const label = link[1] ?? "";
          const href = link[2] ?? "";
          return safeHref(href) ? (
            <Link key={index} href={href} className="text-primary underline">
              {label}
            </Link>
          ) : (
            <span key={index}>{label}</span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

function safeHref(value: string) {
  return (
    value.startsWith("/") ||
    value.startsWith("https://") ||
    value.startsWith("http://") ||
    value.startsWith("mailto:")
  );
}
