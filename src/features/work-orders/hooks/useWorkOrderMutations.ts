import {useCallback} from 'react';
import {useAppDispatch} from '../../../shared/hooks';
import {
  createWorkOrder as createWorkOrderAction,
  updateWorkOrder as updateWorkOrderAction,
  deleteWorkOrder as deleteWorkOrderAction,
} from '../../../store';
import type {CreateWorkOrderInput, UpdateWorkOrderInput} from '../../../types';

export function useWorkOrderMutations() {
  const dispatch = useAppDispatch();

  const createWorkOrder = useCallback(
    async (input: CreateWorkOrderInput) => {
      const result = await dispatch(createWorkOrderAction(input));

      if (createWorkOrderAction.rejected.match(result)) {
        throw new Error(result.payload as string);
      }

      return result.payload;
    },
    [dispatch],
  );

  const updateWorkOrder = useCallback(
    async (id: string, input: UpdateWorkOrderInput) => {
      const result = await dispatch(updateWorkOrderAction({id, input}));

      if (updateWorkOrderAction.rejected.match(result)) {
        throw new Error(result.payload as string);
      }

      return result.payload;
    },
    [dispatch],
  );

  const deleteWorkOrder = useCallback(
    async (id: string) => {
      const result = await dispatch(deleteWorkOrderAction(id));

      if (deleteWorkOrderAction.rejected.match(result)) {
        throw new Error(result.payload as string);
      }

      return result.payload;
    },
    [dispatch],
  );

  const updateStatus = useCallback(
    async (id: string, status: string) => {
      return updateWorkOrder(id, {status: status as UpdateWorkOrderInput['status']});
    },
    [updateWorkOrder],
  );

  return {
    createWorkOrder,
    updateWorkOrder,
    deleteWorkOrder,
    updateStatus,
  };
}
