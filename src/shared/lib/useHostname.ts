import { useEffect, useState } from "react";
import { ipc } from "./ipc";

let cached: string | null = null;
let fetched = false;

/**
 * The computer's name, fetched once per app run. Null until it arrives and when the core
 * has none; callers show `t("This computer")` then.
 */
export function useHostname(): string | null {
  const [name, setName] = useState(cached);
  useEffect(() => {
    if (fetched) return;
    ipc
      .hostname()
      .then((value) => {
        fetched = true;
        cached = value;
        setName(value);
      })
      .catch(() => setName(null));
  }, []);
  return name;
}
