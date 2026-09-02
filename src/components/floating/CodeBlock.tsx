"use client";

import { useMemo } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-python";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-bash";

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  sh: "bash",
  shell: "bash",
};

function detectLanguage(code: string): string {
  if (/^\s*(def |import |from \w+ import|class \w+.*:|print\()/m.test(code)) return "python";
  if (/^\s*(SELECT|INSERT INTO|UPDATE|DELETE FROM|CREATE TABLE)\b/im.test(code)) return "sql";
  if (/:\s*(string|number|boolean|void|any|unknown)\b|interface\s+\w+|<\w+>/.test(code)) return "typescript";
  return "javascript";
}

/**
 * Prism.highlight() HTML-escapes the source text as part of tokenizing
 * (it never emits the raw input verbatim) before wrapping tokens in <span>,
 * so rendering its output via dangerouslySetInnerHTML here does not create
 * an XSS vector the way rendering arbitrary/raw HTML would — this is the
 * standard, safe pattern for client-side syntax highlighting.
 */
export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const { html, lang } = useMemo(() => {
    const requested = language ? (LANGUAGE_ALIASES[language.toLowerCase()] ?? language.toLowerCase()) : detectLanguage(code);
    const resolvedLang = Prism.languages[requested] ? requested : "javascript";
    const grammar = Prism.languages[resolvedLang];
    return { html: Prism.highlight(code, grammar, resolvedLang), lang: resolvedLang };
  }, [code, language]);

  return (
    <pre className="overflow-x-auto rounded-md bg-black/30 p-2.5 text-[11px] leading-relaxed">
      <code className={`language-${lang}`} dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
}
