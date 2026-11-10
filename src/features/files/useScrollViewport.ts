import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * The scroll position and height of a windowed list's scroller, for `visibleRange`.
 * Scroll events are coalesced per frame; a resize is read at once.
 */
export function useScrollViewport(scroller: RefObject<HTMLElement | null>) {
  const [viewport, setViewport] = useState({ top: 0, height: 0 });

  // Track the scroll position and height; scroll events are coalesced per frame.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      setViewport((prev) =>
        prev.top === el.scrollTop && prev.height === el.clientHeight
          ? prev
          : { top: el.scrollTop, height: el.clientHeight },
      );
    };
    read();
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    const observer = new ResizeObserver(read);
    observer.observe(el);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      el.removeEventListener("scroll", onScroll);
    };
  }, [scroller]);

  return viewport;
}
