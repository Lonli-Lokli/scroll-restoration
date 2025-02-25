# React Scroll Restoration

A lightweight, framework-agnostic scroll restoration solution for React applications. This library helps preserve and restore scroll positions when navigating between pages, providing a smoother user experience.

## Features

- 🔄 Restore scroll positions when navigating back and forth
- 📦 No router dependencies
- 🧩 Compatible with any React routing solution
- 📱 Works with nested scrollable elements
- 🔍 Supports custom location key strategies
- 🌊 Configurable scroll behavior
- 🔌 Extensible navigation detection

## Installation

```bash
npm install react-scroll-restoration
# or
yarn add react-scroll-restoration
# or
pnpm add react-scroll-restoration
```

## Basic Usage

```tsx
import { ScrollRestoration } from 'react-scroll-restoration';

function App() {
  return (
    <>
      <ScrollRestoration />
      {/* Your application content */}
    </>
  );
}
```

## Advanced Usage

### Custom Configuration

```tsx
import { ScrollRestoration } from 'react-scroll-restoration';

function App() {
  return (
    <>
      <ScrollRestoration 
        // Use only pathname for identifying routes
        getKey={(location) => location.pathname}
        // Enable smooth scrolling
        scrollBehavior="smooth"
      />
      {/* Your application content */}
    </>
  );
}
```

### With React Router

```tsx
import { ScrollRestoration } from 'react-scroll-restoration';
import { useLocation, useNavigate } from 'react-router-dom';

function App() {
  const location = useLocation();
  
  return (
    <>
      <ScrollRestoration 
        // Use React Router's location
        getCurrentLocation={() => ({
          href: window.location.href,
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
          state: location.state,
        })}
        // Listen for React Router navigation
        navigationListener={(onNavigate) => {
          const unlisten = history.listen(() => {
            onNavigate(location);
          });
          return unlisten;
        }}
      />
      {/* Your application content */}
    </>
  );
}
```

### With Next.js

```tsx
import { ScrollRestoration } from 'react-scroll-restoration';
import { useRouter } from 'next/router';

function MyApp({ Component, pageProps }) {
  const router = useRouter();
  
  return (
    <>
      <ScrollRestoration 
        getKey={(location) => location.pathname}
        navigationListener={(onNavigate) => {
          const handleRouteChange = () => {
            onNavigate({
              pathname: router.pathname,
              search: router.query ? Object.entries(router.query)
                .map(([key, value]) => `${key}=${value}`)
                .join('&') : '',
              hash: window.location.hash,
              href: window.location.href,
              state: history.state,
            });
          };
          
          router.events.on('routeChangeComplete', handleRouteChange);
          
          return () => {
            router.events.off('routeChangeComplete', handleRouteChange);
          };
        }}
      />
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;
```

## Scrollable Elements

### Using data attribute (recommended)

```tsx
function LongList() {
  return (
    <div 
      className="overflow-auto h-80"
      data-scroll-restoration-id="user-comments"
    >
      {/* Long list content */}
    </div>
  );
}
```

### Using imperative handle

```tsx
import { useRef, useEffect } from 'react';
import { useElementScrollRestoration } from 'react-scroll-restoration';

function LongList() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Get stored scroll position
  const scrollPosition = useElementScrollRestoration({
    getElement: () => containerRef.current,
  });
  
  // Apply stored scroll position on mount
  useEffect(() => {
    if (containerRef.current && scrollPosition) {
      containerRef.current.scrollLeft = scrollPosition.scrollX;
      containerRef.current.scrollTop = scrollPosition.scrollY;
    }
  }, [scrollPosition]);
  
  return (
    <div 
      ref={containerRef}
      className="overflow-auto h-80"
    >
      {/* Long list content */}
    </div>
  );
}
```

## API Reference

### `useScrollRestoration(options?)`

The main hook for enabling scroll restoration.

#### Options

| Option | Type | Description |
|--------|------|-------------|
| `getKey` | `(location: Location) => string` | Function to generate a unique key for a location |
| `scrollBehavior` | `'auto' \| 'smooth'` | Scroll behavior when restoring position |
| `getCurrentLocation` | `() => Location` | Function to get current location |
| `navigationListener` | `(onNavigate: (location: Location) => void) => () => void` | Function to listen for location changes |

### `ScrollRestoration` Component

A component wrapper for `useScrollRestoration` that returns `null`.

```tsx
<ScrollRestoration
  getKey={(location) => location.pathname}
  scrollBehavior="smooth"
/>
```

### `useElementScrollRestoration(options)`

A hook for retrieving stored scroll positions for specific elements.

#### Options

| Option | Type | Description |
|--------|------|-------------|
| `id` | `string` | ID to use with `data-scroll-restoration-id` attribute |
| `getElement` | `() => Element \| null \| undefined` | Function to get the element reference |
| `getKey` | `(location: Location) => string` | Function to generate a unique key for a location |
| `getCurrentLocation` | `() => Location` | Function to get current location |

## Browser Support

The library works in all modern browsers that support these APIs:
- `sessionStorage`
- `window.history`
- `MutationObserver`

## TypeScript Support

This library is written in TypeScript and provides type definitions out of the box.

## License

MIT