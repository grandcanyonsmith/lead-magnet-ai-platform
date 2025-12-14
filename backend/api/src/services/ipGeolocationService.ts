/**
 * IP Geolocation Service
 * Provides IP address geolocation lookup functionality.
 */

import { logger } from '../utils/logger';

interface LocationData {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

interface IpApiResponse {
  status: 'success' | 'fail';
  message?: string;
  country?: string;
  regionName?: string;
  city?: string;
  lat?: number;
  lon?: number;
}

// Simple in-memory cache to avoid repeated lookups
const locationCache = new Map<string, { data: LocationData; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class IPGeolocationService {
  /**
   * Get location data from IP address.
   * Uses free ip-api.com service with caching.
   * 
   * @param ipAddress - IP address to lookup
   * @returns Location data or null if lookup fails
   */
  async getLocationFromIP(ipAddress: string): Promise<LocationData | null> {
    if (!ipAddress || ipAddress === '::1' || ipAddress === '127.0.0.1') {
      // Localhost - return null
      return null;
    }

    // Check cache first
    const cached = locationCache.get(ipAddress);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      logger.debug('[IP Geolocation] Using cached location', { ipAddress, location: cached.data });
      return cached.data;
    }

    try {
      // Use free ip-api.com service (no API key required, rate limit: 45 requests/minute)
      const response = await fetch(`http://ip-api.com/json/${ipAddress}?fields=status,message,country,regionName,city,lat,lon`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        logger.warn('[IP Geolocation] Failed to fetch location', {
          ipAddress,
          status: response.status,
          statusText: response.statusText,
        });
        return null;
      }

      const data = (await response.json()) as IpApiResponse;

      if (data.status === 'fail') {
        logger.warn('[IP Geolocation] IP lookup failed', {
          ipAddress,
          message: data.message,
        });
        return null;
      }

      const location: LocationData = {
        country: data.country || undefined,
        region: data.regionName || undefined,
        city: data.city || undefined,
        latitude: data.lat || undefined,
        longitude: data.lon || undefined,
      };

      // Cache the result
      locationCache.set(ipAddress, {
        data: location,
        timestamp: Date.now(),
      });

      logger.debug('[IP Geolocation] Location fetched', { ipAddress, location });
      return location;
    } catch (error: any) {
      logger.error('[IP Geolocation] Error fetching location', {
        ipAddress,
        error: error.message,
        stack: error.stack,
      });
      return null;
    }
  }

  /**
   * Clear the location cache (useful for testing or manual cache invalidation).
   */
  clearCache(): void {
    locationCache.clear();
  }
}

export const ipGeolocationService = new IPGeolocationService();
