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
