import {AppState, AppStateStatus} from 'react-native';
import BackgroundFetch, {
  BackgroundFetchStatus,
  HeadlessEvent,
  NetworkType,
} from 'react-native-background-fetch';
import {syncEngine} from '../sync';
import {networkMonitor} from './NetworkMonitor';

export interface BackgroundSyncConfig {
  minimumFetchInterval: number; // minutes
  enableHeadless: boolean;
  forceAlarmManager: boolean;
  stopOnTerminate: boolean;
  startOnBoot: boolean;
  requiredNetworkType: 'any' | 'unmetered' | 'cellular';
}

const DEFAULT_CONFIG: BackgroundSyncConfig = {
  minimumFetchInterval: 15, // 15 minutes minimum on iOS
  enableHeadless: true,
  forceAlarmManager: false, // Use JobScheduler on Android
  stopOnTerminate: false,
  startOnBoot: true,
  requiredNetworkType: 'any',
};

export class BackgroundSyncService {
  private static instance: BackgroundSyncService;
  private config: BackgroundSyncConfig;
  private isInitialized = false;
  private appStateSubscription: {remove: () => void} | null = null;

  private constructor(config: Partial<BackgroundSyncConfig> = {}) {
    this.config = {...DEFAULT_CONFIG, ...config};
  }

  static getInstance(): BackgroundSyncService {
    if (!BackgroundSyncService.instance) {
      BackgroundSyncService.instance = new BackgroundSyncService();
    }
    return BackgroundSyncService.instance;
  }

  async initialize(): Promise<BackgroundFetchStatus> {
    if (this.isInitialized) {
      return BackgroundFetch.status();
    }

    const status = await BackgroundFetch.configure(
      {
        minimumFetchInterval: this.config.minimumFetchInterval,
        forceAlarmManager: this.config.forceAlarmManager,
        stopOnTerminate: this.config.stopOnTerminate,
        startOnBoot: this.config.startOnBoot,
        enableHeadless: this.config.enableHeadless,
        requiredNetworkType: this.getNetworkType(),
      },
      this.onBackgroundFetch,
      this.onTimeout,
    );

    this.isInitialized = true;

    console.log('[BackgroundSync] Initialized with status:', this.getStatusString(status));

    return status;
  }

  private getNetworkType(): NetworkType {
    switch (this.config.requiredNetworkType) {
      case 'unmetered':
        return BackgroundFetch.NETWORK_TYPE_UNMETERED;
      case 'cellular':
        return BackgroundFetch.NETWORK_TYPE_CELLULAR;
      default:
        return BackgroundFetch.NETWORK_TYPE_ANY;
    }
  }

  private getStatusString(status: BackgroundFetchStatus): string {
    switch (status) {
      case BackgroundFetch.STATUS_RESTRICTED:
        return 'restricted';
      case BackgroundFetch.STATUS_DENIED:
        return 'denied';
      case BackgroundFetch.STATUS_AVAILABLE:
        return 'available';
      default:
        return 'unknown';
    }
  }

  private onBackgroundFetch = async (taskId: string): Promise<void> => {
    console.log('[BackgroundSync] Fetch event received:', taskId);

    try {
      // Check network connectivity
      const networkState = await networkMonitor.refresh();

      if (!networkState.isConnected) {
        console.log('[BackgroundSync] No network connection, skipping sync');
        BackgroundFetch.finish(taskId);
        return;
      }

      // Run sync
      const pendingCount = syncEngine.getPendingCount();

      if (pendingCount > 0) {
        console.log(`[BackgroundSync] Syncing ${pendingCount} pending items`);
        await syncEngine.syncNow();
      } else {
        console.log('[BackgroundSync] No pending items to sync');
      }

      // Check for race condition: Don't pull if sync is already running
      if (syncEngine.isRunning()) {
        console.log('[BackgroundSync] Sync engine running, skipping pull');
        BackgroundFetch.finish(taskId);
        return;
      }

      // Also pull updates from server
      try {
        await syncEngine.pullUpdates();
      } catch (error) {
        console.error('[BackgroundSync] Failed to pull updates:', error);
      }
    } catch (error) {
      console.error('[BackgroundSync] Sync failed:', error);
    } finally {
      BackgroundFetch.finish(taskId);
    }
  };

  private onTimeout = async (taskId: string): Promise<void> => {
    console.warn('[BackgroundSync] Task timed out:', taskId);
    BackgroundFetch.finish(taskId);
  };

  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    await BackgroundFetch.start();
    
    // Listen for app resume
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange,
    );
    
    console.log('[BackgroundSync] Started');
  }

  private handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      console.log('[BackgroundSync] App resumed, checking for sync');
      await this.onNetworkAvailable();
    }
  };

  async stop(): Promise<void> {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    await BackgroundFetch.stop();
    console.log('[BackgroundSync] Stopped');
  }

  async status(): Promise<BackgroundFetchStatus> {
    return BackgroundFetch.status();
  }

  // Schedule a one-time sync task
  async scheduleSync(delay: number = 0): Promise<void> {
    const taskId = `sync-${Date.now()}`;

    await BackgroundFetch.scheduleTask({
      taskId,
      delay, // milliseconds
      periodic: false,
      forceAlarmManager: this.config.forceAlarmManager,
      requiredNetworkType: this.getNetworkType(),
    });

    console.log(`[BackgroundSync] Scheduled one-time sync: ${taskId}`);
  }

  // Trigger immediate sync when network becomes available
  async onNetworkAvailable(): Promise<void> {
    const pendingCount = syncEngine.getPendingCount();

    if (pendingCount > 0) {
      console.log('[BackgroundSync] Network available, triggering immediate sync');
      await this.scheduleSync(0);
    }
  }
}

// Headless task handler (runs when app is terminated)
export async function backgroundSyncHeadlessTask(event: HeadlessEvent): Promise<void> {
  const taskId = event.taskId;
  const isTimeout = event.timeout;

  if (isTimeout) {
    console.warn('[BackgroundSync] Headless task timed out:', taskId);
    BackgroundFetch.finish(taskId);
    return;
  }

  console.log('[BackgroundSync] Headless task:', taskId);

  try {
    // Initialize services
    await networkMonitor.initialize();

    const networkState = networkMonitor.getState();

    if (!networkState.isConnected) {
      console.log('[BackgroundSync] Headless: No network, skipping');
      BackgroundFetch.finish(taskId);
      return;
    }

    // Note: In headless mode, we can't access the full app context
    // This is a simplified sync that only pushes pending items
    const pendingCount = syncEngine.getPendingCount();

    if (pendingCount > 0) {
      await syncEngine.syncNow();
    }
  } catch (error) {
    console.error('[BackgroundSync] Headless task failed:', error);
  } finally {
    BackgroundFetch.finish(taskId);
  }
}

export const backgroundSyncService = BackgroundSyncService.getInstance();
