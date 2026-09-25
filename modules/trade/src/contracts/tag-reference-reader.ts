/**
 * Consumer-owned port: the trade module needs to know which requested tag ids
 * exist, but it must not depend on the tag aggregate itself. The database tag
 * adapter implements this structurally.
 */
export interface TradeTagReferenceReader {
  filterExistingTagIds(ids: readonly string[]): readonly string[];
}
