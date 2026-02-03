import {AppRegistry} from 'react-native';
import App from './src/app/App';
import {name as appName} from './app.json';
import {backgroundSyncHeadlessTask} from './src/services/network';
import BackgroundFetch from 'react-native-background-fetch';

// Register the main application
AppRegistry.registerComponent(appName, () => App);

// Register headless task for background sync (Android)
BackgroundFetch.registerHeadlessTask(backgroundSyncHeadlessTask);
