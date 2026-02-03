import {z} from 'zod';

// Work Order Schemas
export const createWorkOrderSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().min(1, 'Description is required'),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  assigneeId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  estimatedHours: z.number().positive().optional(),
});

export const updateWorkOrderSchema = createWorkOrderSchema.partial().extend({
  status: z.enum(['pending', 'in_progress', 'on_hold', 'completed', 'cancelled']).optional(),
  notes: z.string().optional(),
  actualHours: z.number().positive().optional(),
});

// Inspection Schemas
export const inspectionItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  description: z.string().optional(),
});

export const createInspectionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  assetId: z.string().uuid('Invalid asset ID'),
  workOrderId: z.string().uuid().optional(),
  inspectorId: z.string().uuid('Invalid inspector ID'),
  scheduledAt: z.string().datetime(),
  items: z.array(inspectionItemSchema).min(1, 'At least one inspection item required'),
});

// Asset Schemas
export const createAssetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name too long'),
  description: z.string().optional(),
  serialNumber: z.string().optional(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  status: z.enum(['operational', 'maintenance', 'repair', 'decommissioned']).optional(),
  locationId: z.string().uuid().optional(),
  purchaseDate: z.string().datetime().optional(),
  warrantyExpiry: z.string().datetime().optional(),
});

// Auth Schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Validation helper
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): {success: true; data: T} | {success: false; errors: Record<string, string>} {
  const result = schema.safeParse(data);

  if (result.success) {
    return {success: true, data: result.data};
  }

  const errors: Record<string, string> = {};
  result.error.errors.forEach(err => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });

  return {success: false, errors};
}
