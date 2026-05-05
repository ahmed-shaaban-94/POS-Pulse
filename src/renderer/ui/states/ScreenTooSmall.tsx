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
    <main className="screen-too-small" aria-labelledby="screen-too-small-heading">
      <div className="screen-too-small__card">
        <span className="screen-too-small__icon" aria-hidden="true" />
        <h1
          className="screen-too-small__title"
          id="screen-too-small-heading"
          tabIndex={-1}
          ref={headingRef}
        >
          Screen too small
        </h1>
        <p className="screen-too-small__body">
          Use a display at least 1024px wide to run POS Pulse.
        </p>
      </div>
    </main>
  );
}
