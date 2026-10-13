/** A stable empty array: `data ?? []` creates a new array every render and defeats useMemo. */
export const EMPTY: readonly never[] = Object.freeze([]) as readonly never[];
export function orEmpty<T>(list: T[] | null | undefined): T[] {
  return (list ?? (EMPTY as unknown as T[]));
}
