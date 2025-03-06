import { NonNullableUpdater } from './shapes';

// Helper to get CSS selector for an element
export function getCssSelector(el: Element): string {
  const path = [];
  let current = el;
  let parent;

  while ((parent = current.parentNode) && parent.nodeName !== 'HTML') {
    path.unshift(
      `${current.tagName}:nth-child(${
        Array.from(parent.children).indexOf(current) + 1
      })`
    );
    current = parent as Element;
  }

  return `${path.join(' > ')}`.toLowerCase();
}

// Helper for functional updates
export function functionalUpdate<T>(
  updater: NonNullableUpdater<T>,
  value: T
): T {
  return typeof updater === 'function'
    ? (updater as (prev: T) => T)(value)
    : updater;
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null;
  let lastCallTime = 0;

  return function (this: any, ...args: Parameters<T>): void {
    const now = Date.now();
    const remaining = wait - (now - lastCallTime);

    lastArgs = args;

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }

      lastCallTime = now;
      func.apply(this, args);
    } else if (!timeout) {
      // Schedule a call after remaining time in the current interval
      timeout = setTimeout(() => {
        lastCallTime = Date.now();
        timeout = null;
        if (lastArgs) {
          func.apply(this, lastArgs);
        }
      }, remaining);
    }
  };
}
