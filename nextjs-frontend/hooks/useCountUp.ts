"use client";
import { useState, useEffect } from "react";

export function useCountUp(target: number, duration = 900): number {
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (isNaN(target) || target === 0) {
      setVal(target);
      return;
    }
    let start = 0;
    const inc = target / (duration / 16);
    const t = setInterval(() => {
      start += inc;
      if (start >= target) {
        setVal(target);
        clearInterval(t);
      } else {
        setVal(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(t);
  }, [target, duration]);

  return val;
}
