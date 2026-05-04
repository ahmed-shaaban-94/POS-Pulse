import { useEffect, useRef, type JSX } from 'react';

/**
 * ScreenTooSmall — frozen copy per contracts/shell-regions.md §"ScreenTooSmall".
 * Copy strings are load-bearing: they must not be changed without amending
 * the contract and the T013 test.
 */
export function ScreenTooSmall(): JSX.Element {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main aria-labelledby="screen-too-small-heading">
      <h1 id="screen-too-small-heading" tabIndex={-1} ref={headingRef}>
        Screen too small
      </h1>
      <p>Use a display at least 1024px wide to run POS Pulse.</p>
    </main>
  );
}
