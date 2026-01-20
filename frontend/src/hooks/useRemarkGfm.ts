"use client";

import { useEffect, useState } from "react";

export function useRemarkGfm() {
  const [remarkGfm, setRemarkGfm] = useState<any>(null);

  useEffect(() => {
    let active = true;
    import("remark-gfm")
      .then((mod) => {
        if (active) setRemarkGfm(() => mod.default ?? mod);
      })
      .catch(() => {
        if (active) setRemarkGfm(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return remarkGfm;
}
