import React, { useEffect, useState, type ComponentType } from "react";

export function LazySyntaxHighlighter({
  value,
  language,
  className,
  ...props
}: {
  value: string;
  language?: string;
  className?: string;
  [key: string]: any;
}) {
  const [SyntaxHighlighter, setSyntaxHighlighter] =
    useState<ComponentType<any> | null>(null);
  const [style, setStyle] = useState<unknown | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      import("react-syntax-highlighter"),
      import("react-syntax-highlighter/dist/esm/styles/prism"),
    ])
      .then(([syntaxModule, styleModule]) => {
        if (!active) return;
        setSyntaxHighlighter(() => syntaxModule.Prism);
        setStyle(styleModule.vscDarkPlus);
      })
      .catch(() => {
        if (active) {
          setSyntaxHighlighter(null);
          setStyle(null);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (!SyntaxHighlighter || !style) {
    return (
      <pre className={className ?? "m-0 whitespace-pre-wrap break-words font-mono"}>
        {value}
      </pre>
    );
  }

  return (
    <SyntaxHighlighter language={language} style={style} className={className} {...props}>
      {value}
    </SyntaxHighlighter>
  );
}
