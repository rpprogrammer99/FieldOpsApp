import {SyncableEntity} from './Base';

export type AssetStatus = 'operational' | 'maintenance' | 'repair' | 'decommissioned';

export interface Asset extends SyncableEntity {
  name: string;
  description: string | null;
  serialNumber: string | null;
  model: string | null;
  manufacturer: string | null;
  status: AssetStatus;
  locationId: string | null;
  purchaseDate: string | null;
  warrantyExpiry: string | null;
  lastMaintenanceDate: string | null;
  nextMaintenanceDate: string | null;
  metadata: Record<string, unknown>;
}

export interface CreateAssetInput {
  name: string;
  description?: string;
  serialNumber?: string;
  model?: string;
  manufacturer?: string;
  status?: AssetStatus;
  locationId?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateAssetInput {
  name?: string;
  description?: string | null;
  serialNumber?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  status?: AssetStatus;
  locationId?: string | null;
  purchaseDate?: string | null;
  warrantyExpiry?: string | null;
  lastMaintenanceDate?: string | null;
  nextMaintenanceDate?: string | null;
  metadata?: Record<string, unknown>;
}
