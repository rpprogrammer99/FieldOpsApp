# Background Sync Setup Guide

This document explains how to configure and verify the background sync implementation for FieldOpsApp.

## 1. Native Configuration

### Android (`android/app/src/main/AndroidManifest.xml`)
Ensure the following permissions and service definitions are present:

```xml
<manifest ...>
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <application ...>
        <!-- Headless Task Service -->
        <service android:name="com.transistorsoft.rnbackgroundfetch.HeadlessTaskService" android:permission="android.permission.BIND_JOB_SERVICE" android:exported="true" />
    </application>
</manifest>
```

### iOS (`ios/FieldOpsApp/Info.plist`)
Enable Background Modes:

```xml
<key>UIBackgroundModes</key>
<array>
    <string>fetch</string>
    <string>processing</string>
</array>
```

## 2. JavaScript Implementation

### Service: `src/services/network/BackgroundSync.ts`
- **Library**: Uses `react-native-background-fetch` for reliable scheduling.
- **Triggers**:
  - **Periodic**: Runs every 15+ minutes (OS constrained).
  - **App Resume**: Listens to `AppState` calls `syncEngine` immediately when app comes to foreground.
- **Race Condition Prevention**:
  - Checks `syncEngine.isRunning()` before attempting data pulls.
  - Skips sync if network is unavailable (`NetworkMonitor`).

### Initialization: `src/app/providers/NetworkProvider.tsx`
The `NetworkProvider` initializes and starts the background service automatically on app launch.

```typescript
// NetworkProvider.tsx
await backgroundSyncService.start(); // Starts fetch scheduler and app state listener
```

### Headless Task: `index.js`
Registered for Android execution when the app is terminated:

```javascript
import {backgroundSyncHeadlessTask} from './src/services/network';
BackgroundFetch.registerHeadlessTask(backgroundSyncHeadlessTask);
```

## 3. Testing Background Sync

### Simulate iOS
Use Xcode "Simulate Background Fetch" feature:
1. Run app in Simulator
2. Xcode -> Debug -> Simulate Background Fetch

### Simulate Android
Use ADB commands:
```bash
# Force a background fetch event
adb shell cmd jobscheduler run -f com.fieldopsapp 999
```

## 4. Sync Logic Flow

1. **Wake Up**: OS wakes app (Background or Resume).
2. **Network Check**: Verify connectivity.
3. **Push**: Upload pending local changes (`syncEngine.syncNow()`).
4. **Race Check**: If sync is still running (from UI or previous task), abort.
5. **Pull**: Download server updates (`syncEngine.pullUpdates()`).
6. **Finish**: Signal completion to OS (`BackgroundFetch.finish()`).
