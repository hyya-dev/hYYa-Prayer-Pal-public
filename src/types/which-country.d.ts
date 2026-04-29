declare module 'which-country' {
  /**
   * Returns the ISO 3166-1 alpha-3 country code for the given coordinates.
   * @param coord An array of [longitude, latitude]
   * @returns The ISO 3166-1 alpha-3 country code, or null if not found
   */
  export default function whichCountry(coord: [number, number]): string | null;
}
