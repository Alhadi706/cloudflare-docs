import { useState, useCallback } from 'react';
import { createAssetSpatial, updateAssetSpatial, getAssetSpatial, AssetSpatial } from '@/lib/erpSpatialService';

interface UseAssetSpatialReturn {
  syncAssetToMap: (asset: AssetSpatial) => Promise<boolean>;
  updateAssetLocation: (assetId: number, latitude: number, longitude: number) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for syncing ERP assets with spatial (GIS) infrastructure
 */
export const useAssetSpatial = (): UseAssetSpatialReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncAssetToMap = useCallback(async (asset: AssetSpatial): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await createAssetSpatial(asset);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to sync asset to map');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateAssetLocation = useCallback(async (
    assetId: number,
    latitude: number,
    longitude: number
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await updateAssetSpatial(assetId, { latitude, longitude });
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to update asset location');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    syncAssetToMap,
    updateAssetLocation,
    isLoading,
    error
  };
};

interface UseMapNavigationReturn {
  showAssetOnMap: (assetId: number) => void;
  showMapPanel: boolean;
  selectedAssetId: number | null;
  closeMapPanel: () => void;
}

/**
 * Hook for managing map panel visibility and navigation
 */
export const useMapNavigation = (): UseMapNavigationReturn => {
  const [showMapPanel, setShowMapPanel] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);

  const showAssetOnMap = useCallback((assetId: number) => {
    setSelectedAssetId(assetId);
    setShowMapPanel(true);
  }, []);

  const closeMapPanel = useCallback(() => {
    setShowMapPanel(false);
    setSelectedAssetId(null);
  }, []);

  return {
    showAssetOnMap,
    showMapPanel,
    selectedAssetId,
    closeMapPanel
  };
};
