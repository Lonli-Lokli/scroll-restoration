import * as React from 'react';
import { Cache, CacheState, Location, ScrollRestorationOptions } from './shapes';
import {
  storageKey,
  windowKey,
  delimiter,
  SCROLL_SAVE_EVENT,
  SCROLL_RESTORE_EVENT,
} from './constants';
import { functionalUpdate, getCssSelector } from './helpers';

// Use appropriate effect based on environment
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

// WeakSet to track scrolled elements
let weakScrolledElements = new WeakSet<any>();

// Create storage cache
const createCache = (): Cache => {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return {
      state: { cached: {}, next: {} },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      set: () => {},
    };
  }

  const state: CacheState = JSON.parse(
    window.sessionStorage.getItem(storageKey) || 'null'
  ) || { cached: {}, next: {} };

  return {
    state,
    set: (updater) => {
      cache.state = functionalUpdate(updater, cache.state);
      window.sessionStorage.setItem(storageKey, JSON.stringify(cache.state));
    },
  };
};

const cache = createCache();

/**
 * Default getKey function
 */
const defaultGetKey = (location: Location): string => {
  return location.state?.key || location.href;
};

/**
 * Default function to get current location
 */
const defaultGetCurrentLocation = (): Location => {
  if (typeof window === 'undefined') {
    return { href: '', pathname: '', search: '', hash: '' };
  }

  return {
    href: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    state: window.history.state,
  };
};

/**
 * Default navigation listener that uses popstate event
 * No monkey patching, just listening to the standard navigation event
 */
const defaultNavigationListener = (
  onNavigate: (location: Location) => void
): (() => void) => {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  if (typeof window === 'undefined') return () => {};

  // Initial location
  let lastLocation = defaultGetCurrentLocation();

  // We use a custom event to handle programmatic navigation
  //const navigationEvent = new Event('scrollRestorationNavigate');
  let navigationTimeout: number | null = null;

  // Trigger our custom event when URL changes for any reason
  const checkForUrlChange = () => {
    const currentLocation = defaultGetCurrentLocation();

    if (
      currentLocation.pathname !== lastLocation.pathname ||
      currentLocation.search !== lastLocation.search ||
      currentLocation.hash !== lastLocation.hash
    ) {
      const prevLocation = lastLocation;

      // Trigger scroll position save BEFORE updating location
      saveCurrentScrollPositions();

      lastLocation = currentLocation;
      onNavigate(prevLocation);
    }
  };

  // Listen for popstate event
  const handlePopState = () => {
    checkForUrlChange();
  };

  window.addEventListener('popstate', handlePopState);

  // Setup MutationObserver to detect programmatic navigation
  // This is a non-intrusive way to detect changes without monkey patching
  const observer = new MutationObserver(() => {
    // Debounce the check
    if (navigationTimeout !== null) {
      window.clearTimeout(navigationTimeout);
    }

    navigationTimeout = window.setTimeout(() => {
      checkForUrlChange();
      navigationTimeout = null;
    }, 0);
  });

  // Start observing changes to the URL
  observer.observe(
    document.querySelector('head > title') || document.documentElement,
    {
      subtree: true,
      childList: true,
    }
  );

  return () => {
    window.removeEventListener('popstate', handlePopState);
    observer.disconnect();
    if (navigationTimeout !== null) {
      window.clearTimeout(navigationTimeout);
    }
  };
};

/**
 * Trigger scroll position saving
 */
export function saveCurrentScrollPositions(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SCROLL_SAVE_EVENT));
  }
}

/**
 * Trigger scroll position restoring
 */
export function restoreScrollPositions(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SCROLL_RESTORE_EVENT));
  }
}

/**
 * Hook for scroll restoration in React applications
 */
export function useScrollRestoration(options?: ScrollRestorationOptions) {
  const getKey = options?.getKey || defaultGetKey;
  const getCurrentLocation =
    options?.getCurrentLocation || defaultGetCurrentLocation;
  const navigationListener =
    options?.navigationListener || defaultNavigationListener;

  // Store the latest location
  const locationRef = React.useRef(getCurrentLocation());

  // Handle saving scroll positions
  const saveScrollPositions = React.useCallback(
    (currentLocation: Location) => {
      if (typeof window === 'undefined') return;

      const locationKey = getKey(currentLocation);

      for (const elementSelector in cache.state.next) {
        const entry = cache.state.next[elementSelector]!;

        if (elementSelector === windowKey) {
          entry.scrollX = window.scrollX || 0;
          entry.scrollY = window.scrollY || 0;
        } else if (elementSelector) {
          const element = document.querySelector(elementSelector);
          entry.scrollX = element?.scrollLeft || 0;
          entry.scrollY = element?.scrollTop || 0;
        }

        cache.set((c) => {
          const next = { ...c.next };
          delete next[elementSelector];

          return {
            ...c,
            next,
            cached: {
              ...c.cached,
              [[locationKey, elementSelector].join(delimiter)]: entry,
            },
          };
        });
      }
    },
    [getKey]
  );

  // Handle restoring scroll positions
  const restoreScrollPositions = React.useCallback(
    (currentLocation: Location) => {
      if (typeof window === 'undefined') return;

      const locationKey = getKey(currentLocation);
      let windowRestored = false;

      for (const cacheKey in cache.state.cached) {
        const entry = cache.state.cached[cacheKey]!;
        const [key, elementSelector] = cacheKey.split(delimiter);

        if (key === locationKey) {
          if (elementSelector === windowKey) {
            windowRestored = true;
            window.scrollTo({
              top: entry.scrollY,
              left: entry.scrollX,
              behavior: options?.scrollBehavior,
            });
          } else if (elementSelector) {
            const element = document.querySelector(elementSelector);
            if (element) {
              element.scrollLeft = entry.scrollX;
              element.scrollTop = entry.scrollY;
            }
          }
        }
      }

      if (!windowRestored) {
        window.scrollTo(0, 0);
      }

      cache.set((c) => ({ ...c, next: {} }));
      weakScrolledElements = new WeakSet<any>();
    },
    [getKey, options?.scrollBehavior]
  );

  // Handle navigation
  const handleNavigation = React.useCallback(() => {
    // Update location reference
    locationRef.current = getCurrentLocation();

    // Wait for new DOM to be ready
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        restoreScrollPositions(locationRef.current);
      });
    });
  }, [getCurrentLocation, restoreScrollPositions]);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    // Set manual scroll restoration
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    // Track scroll events
    const onScroll = (event: Event) => {
      if (weakScrolledElements.has(event.target)) return;
      weakScrolledElements.add(event.target);

      let elementSelector = '';

      if (event.target === document || event.target === window) {
        elementSelector = windowKey;
      } else {
        const target = event.target as Element;
        const attrId = target.getAttribute('data-scroll-restoration-id');

        if (attrId) {
          elementSelector = `[data-scroll-restoration-id="${attrId}"]`;
        } else {
          elementSelector = getCssSelector(target);
        }
      }

      if (!cache.state.next[elementSelector]) {
        cache.set((c) => ({
          ...c,
          next: {
            ...c.next,
            [elementSelector]: {
              scrollX: NaN,
              scrollY: NaN,
            },
          },
        }));
      }
    };

    // Create stable event handler for scroll saving
    const handleScrollSave = () => {
      saveScrollPositions(locationRef.current);
    };

     // Create stable event handler for scroll restoring
     const handleScrollRestore = () => {
      restoreScrollPositions(locationRef.current);
      
    };

    // Listen for scroll events
    document.addEventListener('scroll', onScroll, true);

    // Listen for save requests
    window.addEventListener(SCROLL_SAVE_EVENT, handleScrollSave);

      // Listen for restore requests
    window.addEventListener(SCROLL_RESTORE_EVENT, handleScrollRestore);

    // Setup navigation listener
    const cleanup = navigationListener(handleNavigation);

    // Initialize with current location
    locationRef.current = getCurrentLocation();

    return () => {
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener(SCROLL_SAVE_EVENT, handleScrollSave);
      window.removeEventListener(SCROLL_RESTORE_EVENT, handleScrollRestore);
      cleanup();
    };
  }, [
    options?.getKey,
    options?.scrollBehavior,
    navigationListener,
    handleNavigation,
    saveScrollPositions,
    restoreScrollPositions,
    getCurrentLocation,
  ]);
}

/**
 * ScrollRestoration component
 */
export function ScrollRestoration(props: ScrollRestorationOptions) {
  useScrollRestoration(props);
  return null;
}

/**
 * Hook for element-specific scroll restoration
 */
export function useElementScrollRestoration(
  options: (
    | {
        id: string;
        getElement?: () => Element | undefined | null;
      }
    | {
        id?: string;
        getElement: () => Element | undefined | null;
      }
  ) & {
    getKey?: (location: Location) => string;
    getCurrentLocation?: () => Location;
  }
) {
  const getKey = options.getKey || defaultGetKey;
  const getCurrentLocation =
    options.getCurrentLocation || defaultGetCurrentLocation;

  // Get current location
  const location = getCurrentLocation();

  let elementSelector = '';

  if (options.id) {
    elementSelector = `[data-scroll-restoration-id="${options.id}"]`;
  } else {
    const element = options.getElement?.();
    if (!element) {
      return;
    }
    elementSelector = getCssSelector(element);
  }

  const restoreKey = getKey(location);
  const cacheKey = [restoreKey, elementSelector].join(delimiter);
  return cache.state.cached[cacheKey];
}
