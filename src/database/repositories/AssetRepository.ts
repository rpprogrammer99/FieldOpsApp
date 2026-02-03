import {BaseRepository} from './BaseRepository';
import {TABLE_NAMES} from '../schema';
import type {
  Asset,
  AssetStatus,
  CreateAssetInput,
  UpdateAssetInput,
  SyncStatus,
} from '../../types';

interface AssetRow {
  id: string;
  name: string;
  description: string | null;
  serial_number: string | null;
  model: string | null;
  manufacturer: string | null;
  status: string;
  location_id: string | null;
  purchase_date: string | null;
  warranty_expiry: string | null;
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
  metadata: string | null;
  sync_status: string;
  local_version: number;
  server_version: number | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export class AssetRepository extends BaseRepository<
  Asset,
  CreateAssetInput,
  UpdateAssetInput
> {
  protected tableName = TABLE_NAMES.ASSETS;

  protected mapRowToEntity(row: Record<string, unknown>): Asset {
    const r = row as AssetRow;
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      serialNumber: r.serial_number,
      model: r.model,
      manufacturer: r.manufacturer,
      status: r.status as AssetStatus,
      locationId: r.location_id,
      purchaseDate: r.purchase_date,
      warrantyExpiry: r.warranty_expiry,
      lastMaintenanceDate: r.last_maintenance_date,
      nextMaintenanceDate: r.next_maintenance_date,
      metadata: r.metadata ? JSON.parse(r.metadata) : {},
      syncStatus: r.sync_status as SyncStatus,
      localVersion: r.local_version,
      serverVersion: r.server_version,
      lastSyncedAt: r.last_synced_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  protected mapEntityToRow(entity: Partial<Asset>): Record<string, unknown> {
    const row: Record<string, unknown> = {};

    if (entity.id !== undefined) row.id = entity.id;
    if (entity.name !== undefined) row.name = entity.name;
    if (entity.description !== undefined) row.description = entity.description;
    if (entity.serialNumber !== undefined) row.serial_number = entity.serialNumber;
    if (entity.model !== undefined) row.model = entity.model;
    if (entity.manufacturer !== undefined) row.manufacturer = entity.manufacturer;
    if (entity.status !== undefined) row.status = entity.status;
    if (entity.locationId !== undefined) row.location_id = entity.locationId;
    if (entity.purchaseDate !== undefined) row.purchase_date = entity.purchaseDate;
    if (entity.warrantyExpiry !== undefined) row.warranty_expiry = entity.warrantyExpiry;
    if (entity.lastMaintenanceDate !== undefined) {
      row.last_maintenance_date = entity.lastMaintenanceDate;
    }
    if (entity.nextMaintenanceDate !== undefined) {
      row.next_maintenance_date = entity.nextMaintenanceDate;
    }
    if (entity.metadata !== undefined) row.metadata = JSON.stringify(entity.metadata);
    if (entity.syncStatus !== undefined) row.sync_status = entity.syncStatus;
    if (entity.localVersion !== undefined) row.local_version = entity.localVersion;
    if (entity.serverVersion !== undefined) row.server_version = entity.serverVersion;
    if (entity.lastSyncedAt !== undefined) row.last_synced_at = entity.lastSyncedAt;
    if (entity.createdAt !== undefined) row.created_at = entity.createdAt;
    if (entity.updatedAt !== undefined) row.updated_at = entity.updatedAt;

    return row;
  }

  findByStatus(status: AssetStatus): Asset[] {
    return this.findAll({where: {status}, orderBy: 'name', order: 'ASC'});
  }

  findByLocation(locationId: string): Asset[] {
    return this.findAll({where: {locationId}, orderBy: 'name', order: 'ASC'});
  }

  findBySerialNumber(serialNumber: string): Asset | null {
    const assets = this.findAll({where: {serialNumber}});
    return assets[0] || null;
  }

  search(query: string): Asset[] {
    const result = this.executeRaw(
      `SELECT * FROM ${this.tableName}
       WHERE name LIKE ? OR serial_number LIKE ? OR model LIKE ?
       ORDER BY name ASC;`,
      [`%${query}%`, `%${query}%`, `%${query}%`],
    );

    return result.rows._array.map(row =>
      this.mapRowToEntity(row as Record<string, unknown>),
    );
  }

  findNeedingMaintenance(): Asset[] {
    const now = new Date().toISOString();

    const result = this.executeRaw(
      `SELECT * FROM ${this.tableName}
       WHERE next_maintenance_date <= ?
         AND status = 'operational'
       ORDER BY next_maintenance_date ASC;`,
      [now],
    );

    return result.rows._array.map(row =>
      this.mapRowToEntity(row as Record<string, unknown>),
    );
  }

  findWithExpiringWarranty(days: number = 30): Asset[] {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const result = this.executeRaw(
      `SELECT * FROM ${this.tableName}
       WHERE warranty_expiry BETWEEN ? AND ?
       ORDER BY warranty_expiry ASC;`,
      [now.toISOString(), future.toISOString()],
    );

    return result.rows._array.map(row =>
      this.mapRowToEntity(row as Record<string, unknown>),
    );
  }

  updateStatus(id: string, status: AssetStatus): Asset | null {
    return this.update(id, {status});
  }

  recordMaintenance(id: string, nextMaintenanceDate?: string): Asset | null {
    const now = new Date().toISOString();

    return this.update(id, {
      lastMaintenanceDate: now,
      nextMaintenanceDate,
      status: 'operational',
    });
  }

  getStatistics(): {
    total: number;
    byStatus: Record<AssetStatus, number>;
    needingMaintenance: number;
    expiringWarranty: number;
  } {
    const total = this.count();

    const statusResult = this.executeRaw(
      `SELECT status, COUNT(*) as count FROM ${this.tableName} GROUP BY status;`,
    );

    const byStatus: Record<AssetStatus, number> = {
      operational: 0,
      maintenance: 0,
      repair: 0,
      decommissioned: 0,
    };

    for (const row of statusResult.rows._array) {
      const r = row as {status: AssetStatus; count: number};
      byStatus[r.status] = r.count;
    }

    const needingMaintenance = this.findNeedingMaintenance().length;
    const expiringWarranty = this.findWithExpiringWarranty(30).length;

    return {total, byStatus, needingMaintenance, expiringWarranty};
  }
}

export const assetRepository = new AssetRepository();
