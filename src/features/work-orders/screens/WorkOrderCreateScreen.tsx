import React, {useState, useCallback} from 'react';
import {View, Text, StyleSheet, Alert, ScrollView} from 'react-native';
import {useForm, Controller} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {ScreenWrapper, Button, TextInput} from '../../../shared/components';
import {useWorkOrderMutations} from '../hooks';
import {createWorkOrderSchema} from '../../../shared/utils';
import type {WorkOrderStackScreenProps, CreateWorkOrderInput, WorkOrderPriority} from '../../../types';

type Props = WorkOrderStackScreenProps<'WorkOrderCreate'>;

const PRIORITY_OPTIONS: {value: WorkOrderPriority; label: string}[] = [
  {value: 'low', label: 'Low'},
  {value: 'medium', label: 'Medium'},
  {value: 'high', label: 'High'},
  {value: 'critical', label: 'Critical'},
];

export function WorkOrderCreateScreen({navigation}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {createWorkOrder} = useWorkOrderMutations();

  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm<CreateWorkOrderInput>({
    resolver: zodResolver(createWorkOrderSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'medium',
    },
  });

  const onSubmit = useCallback(
    async (data: CreateWorkOrderInput) => {
      setIsSubmitting(true);
      try {
        await createWorkOrder(data);
        navigation.goBack();
      } catch (error) {
        Alert.alert('Error', (error as Error).message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [createWorkOrder, navigation],
  );

  return (
    <ScreenWrapper>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Create Work Order</Text>

        <Controller
          control={control}
          name="title"
          render={({field: {onChange, onBlur, value}}) => (
            <TextInput
              label="Title"
              placeholder="Enter work order title"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.title?.message}
              autoFocus
            />
          )}
        />

        <Controller
          control={control}
          name="description"
          render={({field: {onChange, onBlur, value}}) => (
            <TextInput
              label="Description"
              placeholder="Describe the work to be done"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.description?.message}
              multiline
              numberOfLines={4}
              style={styles.textArea}
            />
          )}
        />

        <View style={styles.priorityContainer}>
          <Text style={styles.label}>Priority</Text>
          <Controller
            control={control}
            name="priority"
            render={({field: {onChange, value}}) => (
              <View style={styles.priorityButtons}>
                {PRIORITY_OPTIONS.map(option => (
                  <Button
                    key={option.value}
                    title={option.label}
                    variant={value === option.value ? 'primary' : 'outline'}
                    size="small"
                    onPress={() => onChange(option.value)}
                    style={styles.priorityButton}
                  />
                ))}
              </View>
            )}
          />
        </View>

        <Controller
          control={control}
          name="estimatedHours"
          render={({field: {onChange, onBlur, value}}) => (
            <TextInput
              label="Estimated Hours (optional)"
              placeholder="e.g., 2"
              value={value?.toString() || ''}
              onChangeText={text => {
                const num = parseFloat(text);
                onChange(isNaN(num) ? undefined : num);
              }}
              onBlur={onBlur}
              keyboardType="numeric"
              error={errors.estimatedHours?.message}
            />
          )}
        />

        <View style={styles.actions}>
          <Button
            title="Cancel"
            variant="outline"
            onPress={() => navigation.goBack()}
            style={styles.actionButton}
          />
          <Button
            title="Create"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            style={styles.actionButton}
          />
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 24,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  priorityContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3C3C43',
    marginBottom: 8,
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityButton: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 32,
  },
  actionButton: {
    flex: 1,
  },
});
