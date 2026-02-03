import {useEffect, useCallback} from 'react';
import {useAppDispatch, useAppSelector} from '../../../shared/hooks';
import {
  loadWorkOrders,
  selectAllWorkOrders,
  selectFilteredWorkOrders,
  selectWorkOrderById,
  selectWorkOrdersLoading,
  selectWorkOrdersError,
  setFilter,
  clearFilter,
} from '../../../store';
import type {WorkOrderStatus} from '../../../types';

export function useWorkOrders() {
  const dispatch = useAppDispatch();
  const workOrders = useAppSelector(selectFilteredWorkOrders);
  const allWorkOrders = useAppSelector(selectAllWorkOrders);
  const isLoading = useAppSelector(selectWorkOrdersLoading);
  const error = useAppSelector(selectWorkOrdersError);

  useEffect(() => {
    dispatch(loadWorkOrders());
  }, [dispatch]);

  const refresh = useCallback(() => {
    return dispatch(loadWorkOrders());
  }, [dispatch]);

  const filterByStatus = useCallback(
    (status: WorkOrderStatus | null) => {
      dispatch(setFilter({status}));
    },
    [dispatch],
  );

  const filterByAssignee = useCallback(
    (assigneeId: string | null) => {
      dispatch(setFilter({assigneeId}));
    },
    [dispatch],
  );

  const search = useCallback(
    (query: string) => {
      dispatch(setFilter({search: query}));
    },
    [dispatch],
  );

  const resetFilters = useCallback(() => {
    dispatch(clearFilter());
  }, [dispatch]);

  return {
    workOrders,
    allWorkOrders,
    isLoading,
    error,
    refresh,
    filterByStatus,
    filterByAssignee,
    search,
    resetFilters,
  };
}

export function useWorkOrder(id: string) {
  const workOrder = useAppSelector(selectWorkOrderById(id));
  return workOrder;
}
