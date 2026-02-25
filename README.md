# FieldOps — Field Operations Management App

A **React Native** mobile application built for field technicians and operations teams to manage **Work Orders**, **Inspections**, and **Assets** — fully functional **offline** and automatically syncing when connectivity is restored.

---

## 📋 Overview

FieldOps solves a core challenge for field service teams: staying productive without a reliable internet connection. Technicians can create, view, update, and manage work orders and inspections in the field. All changes are stored locally first and then synced to the server in the background, with intelligent conflict resolution to keep data consistent.

---

## ✨ Key Features

### 🗂️ Work Order Management
- Create and manage work orders with title, description, priority, due dates, and estimated/actual hours
- Full status lifecycle: `Pending → In Progress → On Hold → Completed / Cancelled`
- Guarded status transitions (only valid next states are available)
- Assignee, asset, and location associations
- Notes and timeline tracking (created, updated, completed timestamps)
- Real-time sync status indicators (pending, failed, conflict)

### 🔍 Inspections
- Create and manage field inspections linked to assets
- Supports inspection templates for standardized checklist workflows

### 🏗️ Asset Management
- Track physical assets linked to work orders and inspections
- Assets stored and queryable offline via local SQLite database

### 🔄 Offline-First Sync Engine
- **Local-first architecture**: every write goes to SQLite immediately, no waiting for network
- Automatic background sync every 15+ minutes (OS-constrained via `react-native-background-fetch`)
- Foreground sync triggered on app resume (`AppState` listener)
- Android headless task support for syncing while the app is terminated
- **Idempotent sync requests** with unique `idempotencyKey` per record — safe to retry on flaky networks
- **Conflict resolution strategies**:
  - *Last-Write-Wins* (default): compares client/server timestamps
  - *Field-Level Merge*: non-conflicting field changes from different users are preserved
- Batch processing with `Promise.allSettled` — individual failures don't block the rest of the batch
- Concurrency guard: `isRunning()` check prevents overlapping sync sessions
- Per-record sync status tracking: `synced | pending | failed | conflict`
- Dirty field tracking: only modified fields are sent on update

### 📡 Network Awareness
- Live network connectivity monitoring (`@react-native-community/netinfo`)
- Sync automatically pauses offline and resumes when connectivity is restored
- Rate limiting via configurable batch size and max concurrent syncs

### 🔐 Authentication
- Auth feature with its own slice and screens
- Token-based session management via Redux state

---

## 🏛️ Architecture

### Project Structure

```
FieldOpsApp/
├── src/
│   ├── app/
│   │   ├── App.tsx               # Root component
│   │   ├── navigation/           # Root & stack navigators
│   │   └── providers/            # Redux, DB, Network providers
│   │
│   ├── features/                 # Feature-sliced modules
│   │   ├── auth/                 # Login / session screens & hooks
│   │   ├── work-orders/          # Work order list, detail, create & edit
│   │   └── inspections/          # Inspection screens & hooks
│   │
│   ├── services/
│   │   ├── api/                  # Axios client & endpoint definitions
│   │   ├── network/              # NetworkMonitor & BackgroundSync service
│   │   └── sync/                 # SyncEngine, SyncQueue & ConflictResolver
│   │
│   ├── database/
│   │   ├── DatabaseManager.ts    # SQLite singleton (open, migrate, transact)
│   │   ├── schema/               # Table definitions & SQL DDL
│   │   ├── repositories/         # BaseRepository + entity repositories
│   │   └── migrations/           # Version-ordered migration runner
│   │
│   ├── store/
│   │   ├── slices/               # Redux slices: auth, workOrder, sync, network, ui
│   │   └── middleware/           # Sync middleware
│   │
│   ├── shared/
│   │   ├── components/           # Button, Card, Badge, ScreenWrapper, etc.
│   │   ├── hooks/                # useNetworkStatus, useSyncStatus, useSyncQueue
│   │   └── utils/                # Date formatting, UUID generation, validation
│   │
│   └── types/
│       ├── entities/             # WorkOrder, Inspection, Asset, Base types
│       ├── api.ts                # API request/response types
│       ├── navigation.ts         # Type-safe navigation param lists
│       └── sync.ts               # Sync engine types
│
├── android/                      # Android native project
├── ios/                          # iOS native project
└── index.js                      # App entry point + headless task registration
```

### Sync Architecture

```
[User Action]
     │
     ▼
[SQLite Write]  ← local_version = Date.now(), sync_status = 'pending'
     │
     ▼
[SyncEngine picks up pending records]
     │
     ▼
[API Request]  ← includes idempotencyKey
     │
  ┌──┴──┐
  ▼     ▼
[OK]  [Error]
  │     │
  ▼     ▼
synced  failed → last_sync_error recorded, retried on next cycle
  │
  ▼
[Conflict check: server_version mismatch?]
  │
  ├─ Last-Write-Wins / Field-Level Merge
  └─ sync_status = 'conflict' → manual resolution fallback
```

---

## 🛠️ Tech Stack

| Category | Technology |
|---|---|
| **Framework** | React Native 0.78 + React 19 |
| **Language** | TypeScript 5.7 |
| **State Management** | Redux Toolkit + React Redux |
| **Navigation** | React Navigation v7 (Native Stack + Bottom Tabs) |
| **Local Database** | `react-native-quick-sqlite` (SQLite) |
| **Forms** | React Hook Form + Zod validation |
| **Networking** | Axios |
| **Network Status** | `@react-native-community/netinfo` |
| **Background Sync** | `react-native-background-fetch` |
| **ID Generation** | `react-native-uuid` |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **React Native CLI** environment ([guide](https://reactnative.dev/docs/set-up-your-environment))
- **Xcode** (for iOS)
- **Android Studio** (for Android)

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Install iOS pods
npm run pod-install

# 3. Start Metro bundler
npm start

# 4. Run on Android
npm run android

# 5. Run on iOS
npm run ios
```

### Other Scripts

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript type checking (no emit)
npm run test        # Jest test suite
npm run clean       # Clean Android & iOS build artifacts
```

---

## 🔧 Background Sync Configuration

### Android (`android/app/src/main/AndroidManifest.xml`)

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.WAKE_LOCK" />

<service
  android:name="com.transistorsoft.rnbackgroundfetch.HeadlessTaskService"
  android:permission="android.permission.BIND_JOB_SERVICE"
  android:exported="true" />
```

### iOS (`ios/FieldOpsApp/Info.plist`)

```xml
<key>UIBackgroundModes</key>
<array>
  <string>fetch</string>
  <string>processing</string>
</array>
```

### Testing Background Sync

**iOS (Simulator):**
```
Xcode → Debug → Simulate Background Fetch
```

**Android (ADB):**
```bash
adb shell cmd jobscheduler run -f com.fieldopsapp 999
```

---

## 🗄️ Database Schema

The local SQLite database stores all entities with full sync metadata:

### Core Tables
- **`work_orders`** — field work order records
- **`inspections`** — field inspection records linked to assets and templates
- **`inspection_templates`** — standardized checklists
- **`assets`** — physical asset registry
- **`tasks`** — general task management
- **`sync_queue`** — durable queue for pending sync operations

### Sync Fields (on every syncable record)

| Field | Type | Purpose |
|---|---|---|
| `sync_status` | `synced \| pending \| failed \| conflict` | Current sync state |
| `local_version` | `INTEGER` (timestamp) | Incremented on every local change |
| `server_version` | `INTEGER \| null` | Last known server version |
| `last_synced_at` | `TEXT \| null` | Timestamp of last successful sync |
| `last_sync_error` | `TEXT \| null` | Error recorded on failure |
| `dirty_fields` | `TEXT` (JSON array) | Fields changed since last sync |

### Database Migrations

| Version | Migration | Change |
|---|---|---|
| 1 | `initial_schema` | Base tables |
| 2 | `add_work_order_tags` | `tags` column on work_orders |
| 3 | `add_inspection_templates` | `inspection_templates` table + `template_id` on inspections |
| 4 | `add_sync_queue_idempotency` | `idempotency_key`, `priority`, `updated_at` on sync_queue |

---

## 📄 Additional Documentation

| Document | Description |
|---|---|
| [`background_sync_setup.md`](./background_sync_setup.md) | Detailed background sync setup and testing guide |
| [`edge_cases.md`](./edge_cases.md) | Sync engine edge cases and handling strategies |
| [`src/database/README.md`](./src/database/README.md) | Local database layer design and repository interfaces |

---

## 📱 Screens

| Screen | Description |
|---|---|
| **Login** | Authentication entry point |
| **Work Order List** | Browse and filter all work orders |
| **Work Order Detail** | View details, update status, edit or delete |
| **Work Order Create/Edit** | Form for creating and editing work orders |
| **Inspection List** | Browse field inspections |
| **Inspection Detail** | View and complete inspection checklists |

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📝 License

This project is private and not licensed for redistribution.
