/**
 * Shared location utilities for building API search parameters.
 */

import { UserPreferences } from '../types';

export interface LocationParams {
  city: string;
  latitude: number | null;
  longitude: number | null;
  radiusKm: number;
}

/**
 * Build location params from user preferences
 */
export const buildLocationParams = (
  user: UserPreferences,
  options?: { radiusKm?: number }
): LocationParams => {
  return {
    city: user.location.city,
    latitude: user.location.latitude,
    longitude: user.location.longitude,
    radiusKm: options?.radiusKm ?? user.location.radiusKm,
  };
};

/**
 * Build location params with extended radius (for artist searches)
 */
export const buildExtendedLocationParams = (
  user: UserPreferences,
  minRadius: number = 500
): LocationParams => {
  return buildLocationParams(user, {
    radiusKm: Math.max(user.location.radiusKm, minRadius),
  });
};
