export interface VaultLocationPicker {
  pickDirectory(): Promise<string | null>;
}
