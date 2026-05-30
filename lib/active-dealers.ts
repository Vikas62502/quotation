/** Dealer row shape used for active/inactive checks in dropdowns. */
export type DealerWithActiveFlag = {
  isActive?: boolean | null
}

/** True when dealer is approved/active (matches admin dealer list normalization). */
export function isActiveDealer(dealer: DealerWithActiveFlag | null | undefined): boolean {
  return dealer?.isActive === true
}

export function filterActiveDealers<T extends DealerWithActiveFlag>(dealers: T[]): T[] {
  return dealers.filter(isActiveDealer)
}
