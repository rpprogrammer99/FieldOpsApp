import {useEffect} from 'react';
import {useAppDispatch, useAppSelector} from './useAppDispatch';
import {networkMonitor} from '../../services/network';
import {setNetworkState, selectIsOnline, selectNetworkStatus} from '../../store';

export function useNetworkStatus() {
  const dispatch = useAppDispatch();
  const isOnline = useAppSelector(selectIsOnline);
  const status = useAppSelector(selectNetworkStatus);

  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe(state => {
      dispatch(setNetworkState(state));
    });

    return unsubscribe;
  }, [dispatch]);

  return {
    isOnline,
    status,
    refresh: () => networkMonitor.refresh(),
  };
}
