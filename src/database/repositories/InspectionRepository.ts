import {BaseRepository} from './BaseRepository';
import {databaseManager} from '../DatabaseManager';
import {TABLE_NAMES} from '../schema';
import type {
  Inspection,
  InspectionItem,
  InspectionStatus,
  InspectionResult,
  CreateInspectionInput,
  UpdateInspectionInput,
  SyncStatus,
} from '../../types';
import {generateUUID} from '../../shared/utils/uuid';

interface InspectionRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  asset_id: string;
  work_order_id: string | null;
  inspector_id: string;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  overall_result: string | null;
  signature: string | null;
  sync_status: string;
  local_version: number;
  server_version: number | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

interface InspectionItemRow {
  id: string;
  inspection_id: string;
  name: string;
  description: string | null;
  result: string | null;
  notes: string | null;
  photo_urls: string | null;
  sort_order: number;
}

export class InspectionRepository extends BaseRepository<
  Inspection,
  CreateInspectionInput,
  UpdateInspectionInput
> {
  protected tableName = TABLE_NAMES.INSPECTIONS;

  protected mapRowToEntity(row: Record<string, unknown>): Inspection {
    const r = row as unknown as InspectionRow;
    const items = this.getInspectionItems(r.id);

    return {
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status as InspectionStatus,
      assetId: r.asset_id,
      workOrderId: r.work_order_id,
      inspectorId: r.inspector_id,
      scheduledAt: r.scheduled_at,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      items,
      overallResult: r.overall_result as InspectionResult | null,
      signature: r.signature,
      syncStatus: r.sync_status as SyncStatus,
      localVersion: r.local_version,
      serverVersion: r.server_version,
      lastSyncedAt: r.last_synced_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  protected mapEntityToRow(entity: Partial<Inspection>): Record<string, unknown> {
    const row: Record<string, unknown> = {};

    if (entity.id !== undefined) row.id = entity.id;
    if (entity.title !== undefined) row.title = entity.title;
    if (entity.description !== undefined) row.description = entity.description;
    if (entity.status !== undefined) row.status = entity.status;
    if (entity.assetId !== undefined) row.asset_id = entity.assetId;
    if (entity.workOrderId !== undefined) row.work_order_id = entity.workOrderId;
    if (entity.inspectorId !== undefined) row.inspector_id = entity.inspectorId;
    if (entity.scheduledAt !== undefined) row.scheduled_at = entity.scheduledAt;
    if (entity.startedAt !== undefined) row.started_at = entity.startedAt;
    if (entity.completedAt !== undefined) row.completed_at = entity.completedAt;
    if (entity.overallResult !== undefined) row.overall_result = entity.overallResult;
    if (entity.signature !== undefined) row.signature = entity.signature;
    if (entity.syncStatus !== undefined) row.sync_status = entity.syncStatus;
    if (entity.localVersion !== undefined) row.local_version = entity.localVersion;
    if (entity.serverVersion !== undefined) row.server_version = entity.serverVersion;
    if (entity.lastSyncedAt !== undefined) row.last_synced_at = entity.lastSyncedAt;
    if (entity.createdAt !== undefined) row.created_at = entity.createdAt;
    if (entity.updatedAt !== undefined) row.updated_at = entity.updatedAt;

    return row;
  }

  private getInspectionItems(inspectionId: string): InspectionItem[] {
    const result = databaseManager.execute(
      `SELECT * FROM ${TABLE_NAMES.INSPECTION_ITEMS}
       WHERE inspection_id = ?
       ORDER BY sort_order ASC;`,
      [inspectionId],
    );

    return result.rows._array.map(row => {
      const r = row as InspectionItemRow;
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        result: r.result as InspectionResult | null,
        notes: r.notes,
        photoUrls: r.photo_urls ? JSON.parse(r.photo_urls) : [],
      };
    });
  }

  create(input: CreateInspectionInput): Inspection {
    const inspection = super.create({
      ...input,
      items: [],
    } as CreateInspectionInput);

    // Insert inspection items
    if (input.items && input.items.length > 0) {
      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];
        databaseManager.execute(
          `INSERT INTO ${TABLE_NAMES.INSPECTION_ITEMS}
            (id, inspection_id, name, description, sort_order)
           VALUES (?, ?, ?, ?, ?);`,
          [generateUUID(), inspection.id, item.name, item.description || null, i],
        );
      }
    }

    return this.findById(inspection.id)!;
  }

  updateItems(inspectionId: string, items: InspectionItem[]): void {
    databaseManager.transaction(() => {
      // Delete existing items
      databaseManager.execute(
        `DELETE FROM ${TABLE_NAMES.INSPECTION_ITEMS} WHERE inspection_id = ?;`,
        [inspectionId],
      );

      // Insert updated items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        databaseManager.execute(
          `INSERT INTO ${TABLE_NAMES.INSPECTION_ITEMS}
            (id, inspection_id, name, description, result, notes, photo_urls, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            item.id || generateUUID(),
            inspectionId,
            item.name,
            item.description,
            item.result,
            item.notes,
            JSON.stringify(item.photoUrls || []),
            i,
          ],
        );
      }

      // Update inspection sync status
      databaseManager.execute(
        `UPDATE ${this.tableName}
         SET sync_status = 'pending',
             local_version = ?,
             updated_at = ?
         WHERE id = ?;`,
        [Date.now(), new Date().toISOString(), inspectionId],
      );
    });
  }

  updateItemResult(
    inspectionId: string,
    itemId: string,
    result: InspectionResult,
    notes?: string,
  ): void {
    databaseManager.execute(
      `UPDATE ${TABLE_NAMES.INSPECTION_ITEMS}
       SET result = ?, notes = COALESCE(?, notes)
       WHERE id = ? AND inspection_id = ?;`,
      [result, notes, itemId, inspectionId],
    );

    databaseManager.execute(
      `UPDATE ${this.tableName}
       SET sync_status = 'pending',
           local_version = ?,
           updated_at = ?
       WHERE id = ?;`,
      [Date.now(), new Date().toISOString(), inspectionId],
    );
  }

  addItemPhoto(inspectionId: string, itemId: string, photoUrl: string): void {
    const result = databaseManager.execute(
      `SELECT photo_urls FROM ${TABLE_NAMES.INSPECTION_ITEMS}
       WHERE id = ? AND inspection_id = ?;`,
      [itemId, inspectionId],
    );

    if (result.rows.length === 0) return;

    const row = result.rows._array[0] as {photo_urls: string | null};
    const photoUrls: string[] = row.photo_urls ? JSON.parse(row.photo_urls) : [];
    photoUrls.push(photoUrl);

    databaseManager.execute(
      `UPDATE ${TABLE_NAMES.INSPECTION_ITEMS}
       SET photo_urls = ?
       WHERE id = ? AND inspection_id = ?;`,
      [JSON.stringify(photoUrls), itemId, inspectionId],
    );

    databaseManager.execute(
      `UPDATE ${this.tableName}
       SET sync_status = 'pending',
           local_version = ?,
           updated_at = ?
       WHERE id = ?;`,
      [Date.now(), new Date().toISOString(), inspectionId],
    );
  }

  findByStatus(status: InspectionStatus): Inspection[] {
    return this.findAll({where: {status}, orderBy: 'scheduledAt', order: 'ASC'});
  }

  findByAsset(assetId: string): Inspection[] {
    return this.findAll({where: {assetId}, orderBy: 'createdAt', order: 'DESC'});
  }

  findByInspector(inspectorId: string): Inspection[] {
    return this.findAll({where: {inspectorId}, orderBy: 'scheduledAt', order: 'ASC'});
  }

  findByWorkOrder(workOrderId: string): Inspection[] {
    return this.findAll({where: {workOrderId}, orderBy: 'createdAt', order: 'DESC'});
  }

  startInspection(id: string): Inspection | null {
    return this.update(id, {
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    });
  }

  completeInspection(
    id: string,
    overallResult: InspectionResult,
    signature?: string,
  ): Inspection | null {
    return this.update(id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      overallResult,
      signature,
    });
  }

  delete(id: string): boolean {
    return databaseManager.transaction(() => {
      databaseManager.execute(
        `DELETE FROM ${TABLE_NAMES.INSPECTION_ITEMS} WHERE inspection_id = ?;`,
        [id],
      );

      const result = databaseManager.execute(
        `DELETE FROM ${this.tableName} WHERE id = ?;`,
        [id],
      );

      return result.rowsAffected > 0;
    });
  }
}

export const inspectionRepository = new InspectionRepository();
