import { useEffect, useRef } from "react";

export const useAutosave = (callback, delay, deps) => {
  const timeout = useRef();

  useEffect(() => {
    clearTimeout(timeout.current);
    timeout.current = setTimeout(callback, delay);

    return () => clearTimeout(timeout.current);
  }, deps);
};