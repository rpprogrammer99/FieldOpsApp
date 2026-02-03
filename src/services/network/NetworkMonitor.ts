import NetInfo, {
  NetInfoState,
  NetInfoSubscription,
} from '@react-native-community/netinfo';

export type NetworkStatus = 'online' | 'offline' | 'unknown';

export interface NetworkState {
  status: NetworkStatus;
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
  details: NetInfoState['details'];
}

type NetworkChangeHandler = (state: NetworkState) => void;

export class NetworkMonitor {
  private static instance: NetworkMonitor;
  private subscription: NetInfoSubscription | null = null;
  private currentState: NetworkState;
  private handlers: Set<NetworkChangeHandler> = new Set();
  private isInitialized = false;

  private constructor() {
    this.currentState = {
      status: 'unknown',
      isConnected: false,
      isInternetReachable: null,
      type: 'unknown',
      details: null,
    };
  }

  static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor();
    }
    return NetworkMonitor.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Get initial state
    const state = await NetInfo.fetch();
    this.updateState(state);

    // Subscribe to changes
    this.subscription = NetInfo.addEventListener(this.handleNetworkChange);

    this.isInitialized = true;
  }

  private handleNetworkChange = (state: NetInfoState): void => {
    const previousState = this.currentState;
    this.updateState(state);

    // Notify handlers only if connection status changed
    if (previousState.isConnected !== this.currentState.isConnected) {
      this.notifyHandlers();
    }
  };

  private updateState(netInfoState: NetInfoState): void {
    const isConnected = netInfoState.isConnected ?? false;
    const isInternetReachable = netInfoState.isInternetReachable;

    let status: NetworkStatus = 'unknown';
    if (isConnected && isInternetReachable !== false) {
      status = 'online';
    } else if (isConnected === false) {
      status = 'offline';
    }

    this.currentState = {
      status,
      isConnected,
      isInternetReachable,
      type: netInfoState.type,
      details: netInfoState.details,
    };
  }

  private notifyHandlers(): void {
    this.handlers.forEach(handler => {
      try {
        handler(this.currentState);
      } catch (error) {
        console.error('Network handler error:', error);
      }
    });
  }

  subscribe(handler: NetworkChangeHandler): () => void {
    this.handlers.add(handler);

    // Immediately call with current state
    handler(this.currentState);

    return () => {
      this.handlers.delete(handler);
    };
  }

  getState(): NetworkState {
    return {...this.currentState};
  }

  isOnline(): boolean {
    return this.currentState.status === 'online';
  }

  isOffline(): boolean {
    return this.currentState.status === 'offline';
  }

  async refresh(): Promise<NetworkState> {
    const state = await NetInfo.refresh();
    this.updateState(state);
    return this.currentState;
  }

  destroy(): void {
    if (this.subscription) {
      this.subscription();
      this.subscription = null;
    }
    this.handlers.clear();
    this.isInitialized = false;
  }
}

export const networkMonitor = NetworkMonitor.getInstance();
