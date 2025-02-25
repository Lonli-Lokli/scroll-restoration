import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useScrollRestoration,
  useElementScrollRestoration,
  ScrollRestoration,
} from './scroll-restoration';
import { render } from '@testing-library/react';

// Mock sessionStorage
const mockSessionStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value.toString();
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
  };
})();

// Mock document
const mockDocument = (() => {
  const listeners: Record<string, Array<(event: any) => void>> = {};
  return {
    addEventListener: vi.fn((event, callback) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(callback);
    }),
    removeEventListener: vi.fn((event, callback) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((cb) => cb !== callback);
      }
    }),
    querySelector: vi.fn(() => ({
      scrollLeft: 0,
      scrollTop: 0,
      getAttribute: vi.fn(() => null),
      parentNode: null,
      tagName: 'DIV',
      children: [],
    })),
    dispatchEvent: vi.fn((event) => {
      if (listeners[event.type]) {
        listeners[event.type].forEach((callback) => callback(event));
      }
      return true;
    }),
  };
})();

// Mock window
const mockWindow = (() => {
  let mockScrollX = 0;
  let mockScrollY = 0;
  const listeners: Record<string, Array<(event: any) => void>> = {};

  return {
    scrollX: mockScrollX,
    scrollY: mockScrollY,
    scrollTo: vi.fn((options?: ScrollToOptions | number, y?: number) => {
      if (typeof options === 'number' && typeof y === 'number') {
        mockScrollX = options;
        mockScrollY = y;
      } else if (typeof options === 'object') {
        if (options.left !== undefined) mockScrollX = options.left;
        if (options.top !== undefined) mockScrollY = options.top;
      }
    }),
    sessionStorage: mockSessionStorage,
    history: {
      scrollRestoration: 'auto',
      state: {},
      pushState: vi.fn(),
      replaceState: vi.fn(),
    },
    location: {
      href: 'https://example.com/page1',
      pathname: '/page1',
      search: '',
      hash: '',
    },
    setTimeout: vi.fn((callback, ms) => {
      callback();
      return 123;
    }),
    clearTimeout: vi.fn(),
    addEventListener: vi.fn((event, callback) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(callback);
    }),
    removeEventListener: vi.fn((event, callback) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((cb) => cb !== callback);
      }
    }),
    dispatchEvent: vi.fn((event) => {
      if (listeners[event.type]) {
        listeners[event.type].forEach((callback) => callback(event));
      }
      return true;
    }),
    MutationObserver: vi.fn(function (
      this: { observe: any; disconnect: any; callback: any },
      callback
    ) {
      this.observe = vi.fn();
      this.disconnect = vi.fn();
      this.callback = callback;
      return this;
    }),
  };
})();

describe('useScrollRestoration', () => {
  // Setup and teardown
  beforeEach(() => {
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('window', mockWindow);

    // Reset mocks
    vi.clearAllMocks();
    mockSessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should initialize with manual scroll restoration', () => {
    renderHook(() => useScrollRestoration());
    expect(window.history.scrollRestoration).toBe('manual');
  });

  it('should listen for scroll events', () => {
    renderHook(() => useScrollRestoration());
    expect(document.addEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      true
    );
  });

  it('should clean up event listeners on unmount', () => {
    const { unmount } = renderHook(() => useScrollRestoration());
    unmount();
    expect(document.removeEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      true
    );
  });

  it('should save scroll positions before navigation', () => {
    // Setup mock scroll position
    mockWindow.scrollX = 100;
    mockWindow.scrollY = 200;

    const { result } = renderHook(() => useScrollRestoration());

    // Simulate a scroll event
    act(() => {
      const scrollEvent = new Event('scroll');
      Object.defineProperty(scrollEvent, 'target', { value: window });
      document.dispatchEvent(scrollEvent);
    });

    // Simulate navigation
    act(() => {
      const navigationEvent = new Event('scrollRestorationBeforeNavigate');
      window.dispatchEvent(navigationEvent);

      // Change the location
      mockWindow.location.pathname = '/page2';

      // Trigger navigation callback
      const navigationListener = mockWindow.addEventListener.mock.calls.find(
        (call) => call[0] === 'popstate'
      )?.[1];

      if (navigationListener) {
        navigationListener(new Event('popstate'));
      }
    });

    // Check that scroll position was saved
    expect(mockSessionStorage.setItem).toHaveBeenCalled();
    const lastSetItemCall = mockSessionStorage.setItem.mock.calls.pop();
    expect(lastSetItemCall?.[0]).toContain('scroll-restoration');
    expect(lastSetItemCall?.[1]).toContain('100');
    expect(lastSetItemCall?.[1]).toContain('200');
  });

  it('should restore scroll positions after navigation', () => {
    // Setup saved scroll positions in session storage
    const locationKey = 'https://example.com/page2';
    const mockCache = {
      cached: {
        [`${locationKey}___window`]: { scrollX: 150, scrollY: 250 },
      },
      next: {},
    };
    mockSessionStorage.setItem(
      'scroll-restoration-v2',
      JSON.stringify(mockCache)
    );

    // Setup current location
    mockWindow.location.href = locationKey;
    mockWindow.location.pathname = '/page2';

    const { result } = renderHook(() =>
      useScrollRestoration({
        getCurrentLocation: () => ({
          href: locationKey,
          pathname: '/page2',
          search: '',
          hash: '',
          state: {},
        }),
      })
    );

    // Simulate navigation completion
    act(() => {
      const navigationListener = mockWindow.addEventListener.mock.calls.find(
        (call) => call[0] === 'popstate'
      )?.[1];

      if (navigationListener) {
        navigationListener(new Event('popstate'));
      }
    });

    // Check that scroll was restored
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 250,
      left: 150,
      behavior: undefined,
    });
  });

  it('should use custom getKey function when provided', () => {
    const customGetKey = vi.fn((location) => `custom-${location.pathname}`);

    renderHook(() =>
      useScrollRestoration({
        getKey: customGetKey,
      })
    );

    // Simulate navigation
    act(() => {
      const navigationListener = mockWindow.addEventListener.mock.calls.find(
        (call) => call[0] === 'popstate'
      )?.[1];

      if (navigationListener) {
        navigationListener(new Event('popstate'));
      }
    });

    expect(customGetKey).toHaveBeenCalled();
  });

  it('should use custom scrollBehavior when provided', () => {
    // Setup saved scroll positions
    const locationKey = 'https://example.com/page2';
    const mockCache = {
      cached: {
        [`${locationKey}___window`]: { scrollX: 150, scrollY: 250 },
      },
      next: {},
    };
    mockSessionStorage.setItem(
      'scroll-restoration-v2',
      JSON.stringify(mockCache)
    );

    // Setup current location
    mockWindow.location.href = locationKey;
    mockWindow.location.pathname = '/page2';

    renderHook(() =>
      useScrollRestoration({
        scrollBehavior: 'smooth',
        getCurrentLocation: () => ({
          href: locationKey,
          pathname: '/page2',
          search: '',
          hash: '',
          state: {},
        }),
      })
    );

    // Simulate navigation
    act(() => {
      const navigationListener = mockWindow.addEventListener.mock.calls.find(
        (call) => call[0] === 'popstate'
      )?.[1];

      if (navigationListener) {
        navigationListener(new Event('popstate'));
      }
    });

    // Check that scroll behavior was used
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 250,
      left: 150,
      behavior: 'smooth',
    });
  });
});

describe('ScrollRestoration component', () => {
  beforeEach(() => {
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('window', mockWindow);
    vi.clearAllMocks();
    mockSessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should render nothing', () => {
    const { container } = render(<ScrollRestoration />);
    expect(container.firstChild).toBeNull();
  });

  it('should call useScrollRestoration with the provided props', () => {
    const mockGetKey = vi.fn();
    const mockScrollBehavior = 'smooth';

    const useScrollRestorationSpy = vi.spyOn(
      require('./scroll-restoration'),
      'useScrollRestoration'
    );

    render(
      <ScrollRestoration
        getKey={mockGetKey}
        scrollBehavior={mockScrollBehavior}
      />
    );

    expect(useScrollRestorationSpy).toHaveBeenCalledWith({
      getKey: mockGetKey,
      scrollBehavior: mockScrollBehavior,
    });
  });
});

describe('useElementScrollRestoration', () => {
  beforeEach(() => {
    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('window', mockWindow);
    vi.clearAllMocks();
    mockSessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return cached scroll position for an element with ID', () => {
    // Setup mock cached data
    const locationKey = 'https://example.com/page1';
    const elementId = 'test-element';
    const mockCache = {
      cached: {
        [`${locationKey}___[data-scroll-restoration-id="${elementId}"]`]: {
          scrollX: 50,
          scrollY: 100,
        },
      },
      next: {},
    };
    mockSessionStorage.setItem(
      'scroll-restoration-v2',
      JSON.stringify(mockCache)
    );

    const { result } = renderHook(() =>
      useElementScrollRestoration({
        id: elementId,
        getCurrentLocation: () => ({
          href: locationKey,
          pathname: '/page1',
          search: '',
          hash: '',
          state: {},
        }),
      })
    );

    expect(result.current).toEqual({ scrollX: 50, scrollY: 100 });
  });

  it('should return cached scroll position for an element with getElement', () => {
    // Setup mock cached data
    const locationKey = 'https://example.com/page1';
    const mockElement = {
      tagName: 'DIV',
      parentNode: {
        children: [{}],
        nodeName: 'DIV',
        parentNode: { nodeName: 'BODY' },
      },
    };

    // Mock the getCssSelector to return a predictable value
    vi.mock('./scroll-restoration', async (importOriginal) => {
      const mod = await importOriginal() as Record<string, unknown>;
      return {
        ...mod,
        getCssSelector: () => 'div:nth-child(1)',
      };
    });

    const mockCache = {
      cached: {
        [`${locationKey}___div:nth-child(1)`]: {
          scrollX: 75,
          scrollY: 125,
        },
      },
      next: {},
    };
    mockSessionStorage.setItem(
      'scroll-restoration-v2',
      JSON.stringify(mockCache)
    );

    const getElement = vi.fn(() => mockElement as unknown as Element);

    const { result } = renderHook(() =>
      useElementScrollRestoration({
        getElement,
        getCurrentLocation: () => ({
          href: locationKey,
          pathname: '/page1',
          search: '',
          hash: '',
          state: {},
        }),
      })
    );

    expect(getElement).toHaveBeenCalled();
  });

  it('should return undefined if element cannot be found', () => {
    const getElement = vi.fn(() => null);

    const { result } = renderHook(() =>
      useElementScrollRestoration({
        getElement,
      })
    );

    expect(result.current).toBeUndefined();
  });
});
