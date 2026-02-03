import {SyncableEntity} from './Base';

export type InspectionStatus = 'scheduled' | 'in_progress' | 'completed' | 'failed';

export type InspectionResult = 'pass' | 'fail' | 'partial' | 'na';

export interface InspectionItem {
  id: string;
  name: string;
  description: string | null;
  result: InspectionResult | null;
  notes: string | null;
  photoUrls: string[];
}

export interface Inspection extends SyncableEntity {
  title: string;
  description: string | null;
  status: InspectionStatus;
  assetId: string;
  workOrderId: string | null;
  inspectorId: string;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  items: InspectionItem[];
  overallResult: InspectionResult | null;
  signature: string | null;
}

export interface CreateInspectionInput {
  title: string;
  description?: string;
  assetId: string;
  workOrderId?: string;
  inspectorId: string;
  scheduledAt: string;
  items: Omit<InspectionItem, 'result' | 'notes' | 'photoUrls'>[];
}

export interface UpdateInspectionInput {
  status?: InspectionStatus;
  startedAt?: string;
  completedAt?: string;
  items?: InspectionItem[];
  overallResult?: InspectionResult;
  signature?: string;
}
