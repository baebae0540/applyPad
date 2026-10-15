"use client";

import { useEffect, useState } from "react";

/** 검색어처럼 빠르게 바뀌는 값을 일정 시간 멈춘 뒤에만 반영한다 (요청 수 줄이기) */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
