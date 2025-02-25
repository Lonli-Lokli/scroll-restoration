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
