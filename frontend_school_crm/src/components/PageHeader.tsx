import React from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

/**
 * Renders a consistent page title + optional subtitle block.
 * Drop it inside each page's own outer flex/layout wrapper alongside action buttons.
 */
export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div>
      {/* Uses the shared `.text-display` ramp rather than its own
          `text-2xl sm:text-3xl`. The two disagreed, so a page title changed
          size depending on whether the page used this component or the
          utility directly. */}
      <h1 className="text-display text-slate-900 dark:text-slate-100">
        {title}
      </h1>
      {subtitle && (
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
}
