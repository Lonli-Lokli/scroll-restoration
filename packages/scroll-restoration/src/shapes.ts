// Type definitions
export type Location = {
  href: string;
  pathname: string;
  search: string;
  hash: string;
  state?: {
    key?: string;
  };
};

export type NonNullableUpdater<T> = T | ((prev: T) => T);

export type CacheValue = Record<string, { scrollX: number; scrollY: number }>;
export type CacheState = {
  cached: CacheValue;
  next: CacheValue;
};

export type Cache = {
  state: CacheState;
  set: (updater: NonNullableUpdater<CacheState>) => void;
};

export type ScrollRestorationOptions = {
  /**
   * Function to generate a unique key for a location
   */
  getKey?: (location: Location) => string;

  /**
   * Scroll behavior when restoring position
   */
  scrollBehavior?: ScrollToOptions['behavior'];

  /**
   * Optional function to get current location
   */
  getCurrentLocation?: () => Location;

  /**
   * Optional function to listen for location changes
   * This should return a cleanup function
   */
  navigationListener?: (onNavigate: (location: Location) => void) => () => void;
};
