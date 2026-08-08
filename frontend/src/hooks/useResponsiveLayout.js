import { useEffect, useState } from "react";

export function useResponsiveLayout(breakpoint = 1080) {
  const [isCompact, setIsCompact] = useState(() => window.innerWidth < breakpoint);

  useEffect(() => {
    const update = () => setIsCompact(window.innerWidth < breakpoint);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [breakpoint]);

  return isCompact;
}
