export const TABLE_NAMES = {
  WORK_ORDERS: 'work_orders',
  INSPECTIONS: 'inspections',
  INSPECTION_ITEMS: 'inspection_items',
  ASSETS: 'assets',
  SYNC_QUEUE: 'sync_queue',
  MIGRATIONS: 'migrations',
  KEY_VALUE: 'key_value',
} as const;

export const WORK_ORDERS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.WORK_ORDERS} (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    priority TEXT NOT NULL DEFAULT 'medium',
    assignee_id TEXT,
    asset_id TEXT,
    location_id TEXT,
    due_date TEXT,
    completed_at TEXT,
    notes TEXT,
    estimated_hours REAL,
    actual_hours REAL,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    local_version INTEGER NOT NULL DEFAULT 0,
    server_version INTEGER,
    last_synced_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

export const INSPECTIONS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.INSPECTIONS} (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled',
    asset_id TEXT NOT NULL,
    work_order_id TEXT,
    inspector_id TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    overall_result TEXT,
    signature TEXT,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    local_version INTEGER NOT NULL DEFAULT 0,
    server_version INTEGER,
    last_synced_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

export const INSPECTION_ITEMS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.INSPECTION_ITEMS} (
    id TEXT PRIMARY KEY NOT NULL,
    inspection_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    result TEXT,
    notes TEXT,
    photo_urls TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (inspection_id) REFERENCES ${TABLE_NAMES.INSPECTIONS}(id) ON DELETE CASCADE
  );
`;

export const ASSETS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.ASSETS} (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    serial_number TEXT,
    model TEXT,
    manufacturer TEXT,
    status TEXT NOT NULL DEFAULT 'operational',
    location_id TEXT,
    purchase_date TEXT,
    warranty_expiry TEXT,
    last_maintenance_date TEXT,
    next_maintenance_date TEXT,
    metadata TEXT,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    local_version INTEGER NOT NULL DEFAULT 0,
    server_version INTEGER,
    last_synced_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

export const SYNC_QUEUE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.SYNC_QUEUE} (
    id TEXT PRIMARY KEY NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    processed_at TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 5,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    next_retry_at TEXT
  );
`;

export const MIGRATIONS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.MIGRATIONS} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  );
`;

export const KEY_VALUE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.KEY_VALUE} (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

export const INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_work_orders_status ON ${TABLE_NAMES.WORK_ORDERS}(status);`,
  `CREATE INDEX IF NOT EXISTS idx_work_orders_sync_status ON ${TABLE_NAMES.WORK_ORDERS}(sync_status);`,
  `CREATE INDEX IF NOT EXISTS idx_work_orders_assignee ON ${TABLE_NAMES.WORK_ORDERS}(assignee_id);`,
  `CREATE INDEX IF NOT EXISTS idx_work_orders_asset ON ${TABLE_NAMES.WORK_ORDERS}(asset_id);`,
  `CREATE INDEX IF NOT EXISTS idx_inspections_status ON ${TABLE_NAMES.INSPECTIONS}(status);`,
  `CREATE INDEX IF NOT EXISTS idx_inspections_sync_status ON ${TABLE_NAMES.INSPECTIONS}(sync_status);`,
  `CREATE INDEX IF NOT EXISTS idx_inspections_asset ON ${TABLE_NAMES.INSPECTIONS}(asset_id);`,
  `CREATE INDEX IF NOT EXISTS idx_inspection_items_inspection ON ${TABLE_NAMES.INSPECTION_ITEMS}(inspection_id);`,
  `CREATE INDEX IF NOT EXISTS idx_assets_status ON ${TABLE_NAMES.ASSETS}(status);`,
  `CREATE INDEX IF NOT EXISTS idx_assets_sync_status ON ${TABLE_NAMES.ASSETS}(sync_status);`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON ${TABLE_NAMES.SYNC_QUEUE}(status);`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON ${TABLE_NAMES.SYNC_QUEUE}(entity_type, entity_id);`,
];
