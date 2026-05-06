import { createContext, ReactNode, useContext, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

type Ctx = {
  /** number of in-app navigations recorded in this tab session */
  depthRef: React.MutableRefObject<number>;
  /** previous in-app path, if any */
  prevRef: React.MutableRefObject<string | null>;
};

const NavHistoryCtx = createContext<Ctx | null>(null);

export const NavHistoryProvider = ({ children }: { children: ReactNode }) => {
  const depthRef = useRef(0);
  const prevRef = useRef<string | null>(null);
  const lastRef = useRef<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname + location.search;
    if (lastRef.current === null) {
      // first render of the app in this tab
      lastRef.current = path;
      return;
    }
    if (lastRef.current !== path) {
      prevRef.current = lastRef.current;
      lastRef.current = path;
      depthRef.current += 1;
    }
  }, [location.pathname, location.search]);

  return <NavHistoryCtx.Provider value={{ depthRef, prevRef }}>{children}</NavHistoryCtx.Provider>;
};

export const useNavHistory = () => {
  const ctx = useContext(NavHistoryCtx);
  // Fallback no-op refs if provider missing (e.g. tests)
  return (
    ctx ?? {
      depthRef: { current: 0 } as React.MutableRefObject<number>,
      prevRef: { current: null } as React.MutableRefObject<string | null>,
    }
  );
};
