import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {CompositeScreenProps, NavigatorScreenParams} from '@react-navigation/native';

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  WorkOrders: NavigatorScreenParams<WorkOrderStackParamList>;
  Inspections: NavigatorScreenParams<InspectionStackParamList>;
  Assets: NavigatorScreenParams<AssetStackParamList>;
  Settings: undefined;
};

export type WorkOrderStackParamList = {
  WorkOrderList: undefined;
  WorkOrderDetail: {id: string};
  WorkOrderCreate: undefined;
  WorkOrderEdit: {id: string};
};

export type InspectionStackParamList = {
  InspectionList: undefined;
  InspectionDetail: {id: string};
  InspectionCreate: {workOrderId?: string; assetId?: string};
  InspectionExecute: {id: string};
};

export type AssetStackParamList = {
  AssetList: undefined;
  AssetDetail: {id: string};
  AssetCreate: undefined;
  AssetEdit: {id: string};
};

// Root Stack
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

// Auth Stack
export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<AuthStackParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

// Main Tab
export type MainTabScreenProps<T extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

// Work Order Stack
export type WorkOrderStackScreenProps<T extends keyof WorkOrderStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<WorkOrderStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

// Inspection Stack
export type InspectionStackScreenProps<T extends keyof InspectionStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<InspectionStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

// Asset Stack
export type AssetStackScreenProps<T extends keyof AssetStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<AssetStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
