import { useEffect, useState } from "react";
import { ipc } from "./ipc";

let cached: string | null = null;

/** The computer's name, fetched once per app run (null until it arrives). */
export function useHostname(): string | null {
  const [name, setName] = useState(cached);
  useEffect(() => {
    if (cached) return;
    ipc
      .hostname()
      .then((value) => {
        cached = value;
        setName(value);
      })
      .catch(() => setName(null));
  }, []);
  return name;
}
