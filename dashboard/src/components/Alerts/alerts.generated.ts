import * as Types from '../../generated/types';

import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
const defaultOptions = {} as const;
export type GetAlertRulesQueryVariables = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['Cursor']['input']>;
  where?: Types.InputMaybe<Types.AlertRuleWhereInput>;
}>;


export type GetAlertRulesQuery = { __typename?: 'Query', alertRules: { __typename?: 'AlertRuleConnection', totalCount: number, edges?: Array<{ __typename?: 'AlertRuleEdge', node?: { __typename?: 'AlertRule', id: string, name: string, alertType: Types.AlertRuleAlertType, severity: Types.AlertRuleAlertSeverity, enabled: boolean, resourceType: Types.AlertRuleAlertResourceType, resourceID?: string | null, conditions?: Record<string, any> | null, deliveryMode: Types.AlertRuleAlertDeliveryMode, batchIntervalMinutes: number, recipients: Array<string>, cooldownMinutes: number, botModeFilter: Types.AlertRuleAlertBotModeFilter, lastTriggeredAt?: string | null, ownerID: string, createdAt: string, updatedAt: string } | null } | null> | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type CreateAlertRuleMutationVariables = Types.Exact<{
  input: Types.CreateAlertRuleInput;
}>;


export type CreateAlertRuleMutation = { __typename?: 'Mutation', createAlertRule: { __typename?: 'AlertRule', id: string, name: string, alertType: Types.AlertRuleAlertType, severity: Types.AlertRuleAlertSeverity, enabled: boolean, resourceType: Types.AlertRuleAlertResourceType, resourceID?: string | null, conditions?: Record<string, any> | null, deliveryMode: Types.AlertRuleAlertDeliveryMode, batchIntervalMinutes: number, recipients: Array<string>, cooldownMinutes: number, botModeFilter: Types.AlertRuleAlertBotModeFilter } };

export type UpdateAlertRuleMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.UpdateAlertRuleInput;
}>;


export type UpdateAlertRuleMutation = { __typename?: 'Mutation', updateAlertRule: { __typename?: 'AlertRule', id: string, name: string, alertType: Types.AlertRuleAlertType, severity: Types.AlertRuleAlertSeverity, enabled: boolean, resourceType: Types.AlertRuleAlertResourceType, resourceID?: string | null, conditions?: Record<string, any> | null, deliveryMode: Types.AlertRuleAlertDeliveryMode, batchIntervalMinutes: number, recipients: Array<string>, cooldownMinutes: number, botModeFilter: Types.AlertRuleAlertBotModeFilter } };

export type DeleteAlertRuleMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type DeleteAlertRuleMutation = { __typename?: 'Mutation', deleteAlertRule: boolean };

export type ToggleAlertRuleMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  enabled: Types.Scalars['Boolean']['input'];
}>;


export type ToggleAlertRuleMutation = { __typename?: 'Mutation', toggleAlertRule: { __typename?: 'AlertRule', id: string, enabled: boolean } };

export type TestAlertRuleMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type TestAlertRuleMutation = { __typename?: 'Mutation', testAlertRule: boolean };

export type GetAlertTypesForResourceQueryVariables = Types.Exact<{
  resourceType: Types.AlertRuleAlertResourceType;
  resourceID?: Types.InputMaybe<Types.Scalars['ID']['input']>;
}>;


export type GetAlertTypesForResourceQuery = { __typename?: 'Query', alertTypesForResource: Array<{ __typename?: 'AlertTypeInfo', type: Types.AlertRuleAlertType, label: string, description: string, defaultSeverity: Types.AlertRuleAlertSeverity, conditionFields: Array<{ __typename?: 'ConditionField', name: string, label: string, type: Types.ConditionFieldType, required: boolean, description: string, min?: number | null, max?: number | null, default?: number | null, unit?: string | null, options?: Array<{ __typename?: 'SelectOption', value: string, label: string }> | null }> }> };

export type GetAlertEventsQueryVariables = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['Cursor']['input']>;
  where?: Types.InputMaybe<Types.AlertEventWhereInput>;
  orderBy?: Types.InputMaybe<Types.AlertEventOrder>;
}>;


export type GetAlertEventsQuery = { __typename?: 'Query', alertEvents: { __typename?: 'AlertEventConnection', totalCount: number, edges?: Array<{ __typename?: 'AlertEventEdge', node?: { __typename?: 'AlertEvent', id: string, status: Types.AlertEventAlertEventStatus, alertType: Types.AlertEventAlertType, severity: Types.AlertEventAlertSeverity, subject: string, body: string, context?: Record<string, any> | null, recipients: Array<string>, channelType: string, sentAt?: string | null, readAt?: string | null, errorMessage?: string | null, resourceType: Types.AlertEventAlertResourceType, resourceID?: string | null, ownerID: string, createdAt: string, rule: { __typename?: 'AlertRule', id: string, name: string } } | null } | null> | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type GetUnreadAlertCountQueryVariables = Types.Exact<{
  where?: Types.InputMaybe<Types.AlertEventWhereInput>;
}>;


export type GetUnreadAlertCountQuery = { __typename?: 'Query', alertEvents: { __typename?: 'AlertEventConnection', totalCount: number } };

export type MarkAlertEventAsReadMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  ownerID: Types.Scalars['String']['input'];
}>;


export type MarkAlertEventAsReadMutation = { __typename?: 'Mutation', markAlertEventAsRead: { __typename?: 'AlertEvent', id: string, readAt?: string | null } };

export type MarkAllAlertEventsAsReadMutationVariables = Types.Exact<{
  ownerID: Types.Scalars['String']['input'];
}>;


export type MarkAllAlertEventsAsReadMutation = { __typename?: 'Mutation', markAllAlertEventsAsRead: number };


export const GetAlertRulesDocument = gql`
    query GetAlertRules($first: Int, $after: Cursor, $where: AlertRuleWhereInput) {
  alertRules(first: $first, after: $after, where: $where) {
    edges {
      node {
        id
        name
        alertType
        severity
        enabled
        resourceType
        resourceID
        conditions
        deliveryMode
        batchIntervalMinutes
        recipients
        cooldownMinutes
        botModeFilter
        lastTriggeredAt
        ownerID
        createdAt
        updatedAt
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    totalCount
  }
}
    `;

/**
 * __useGetAlertRulesQuery__
 *
 * To run a query within a React component, call `useGetAlertRulesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAlertRulesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAlertRulesQuery({
 *   variables: {
 *      first: // value for 'first'
 *      after: // value for 'after'
 *      where: // value for 'where'
 *   },
 * });
 */
export function useGetAlertRulesQuery(baseOptions?: Apollo.QueryHookOptions<GetAlertRulesQuery, GetAlertRulesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAlertRulesQuery, GetAlertRulesQueryVariables>(GetAlertRulesDocument, options);
      }
export function useGetAlertRulesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAlertRulesQuery, GetAlertRulesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAlertRulesQuery, GetAlertRulesQueryVariables>(GetAlertRulesDocument, options);
        }
// @ts-ignore
export function useGetAlertRulesSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetAlertRulesQuery, GetAlertRulesQueryVariables>): Apollo.UseSuspenseQueryResult<GetAlertRulesQuery, GetAlertRulesQueryVariables>;
export function useGetAlertRulesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetAlertRulesQuery, GetAlertRulesQueryVariables>): Apollo.UseSuspenseQueryResult<GetAlertRulesQuery | undefined, GetAlertRulesQueryVariables>;
export function useGetAlertRulesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetAlertRulesQuery, GetAlertRulesQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetAlertRulesQuery, GetAlertRulesQueryVariables>(GetAlertRulesDocument, options);
        }
export type GetAlertRulesQueryHookResult = ReturnType<typeof useGetAlertRulesQuery>;
export type GetAlertRulesLazyQueryHookResult = ReturnType<typeof useGetAlertRulesLazyQuery>;
export type GetAlertRulesSuspenseQueryHookResult = ReturnType<typeof useGetAlertRulesSuspenseQuery>;
export type GetAlertRulesQueryResult = Apollo.QueryResult<GetAlertRulesQuery, GetAlertRulesQueryVariables>;
export const CreateAlertRuleDocument = gql`
    mutation CreateAlertRule($input: CreateAlertRuleInput!) {
  createAlertRule(input: $input) {
    id
    name
    alertType
    severity
    enabled
    resourceType
    resourceID
    conditions
    deliveryMode
    batchIntervalMinutes
    recipients
    cooldownMinutes
    botModeFilter
  }
}
    `;
export type CreateAlertRuleMutationFn = Apollo.MutationFunction<CreateAlertRuleMutation, CreateAlertRuleMutationVariables>;

/**
 * __useCreateAlertRuleMutation__
 *
 * To run a mutation, you first call `useCreateAlertRuleMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateAlertRuleMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createAlertRuleMutation, { data, loading, error }] = useCreateAlertRuleMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateAlertRuleMutation(baseOptions?: Apollo.MutationHookOptions<CreateAlertRuleMutation, CreateAlertRuleMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateAlertRuleMutation, CreateAlertRuleMutationVariables>(CreateAlertRuleDocument, options);
      }
export type CreateAlertRuleMutationHookResult = ReturnType<typeof useCreateAlertRuleMutation>;
export type CreateAlertRuleMutationResult = Apollo.MutationResult<CreateAlertRuleMutation>;
export type CreateAlertRuleMutationOptions = Apollo.BaseMutationOptions<CreateAlertRuleMutation, CreateAlertRuleMutationVariables>;
export const UpdateAlertRuleDocument = gql`
    mutation UpdateAlertRule($id: ID!, $input: UpdateAlertRuleInput!) {
  updateAlertRule(id: $id, input: $input) {
    id
    name
    alertType
    severity
    enabled
    resourceType
    resourceID
    conditions
    deliveryMode
    batchIntervalMinutes
    recipients
    cooldownMinutes
    botModeFilter
  }
}
    `;
export type UpdateAlertRuleMutationFn = Apollo.MutationFunction<UpdateAlertRuleMutation, UpdateAlertRuleMutationVariables>;

/**
 * __useUpdateAlertRuleMutation__
 *
 * To run a mutation, you first call `useUpdateAlertRuleMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateAlertRuleMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateAlertRuleMutation, { data, loading, error }] = useUpdateAlertRuleMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateAlertRuleMutation(baseOptions?: Apollo.MutationHookOptions<UpdateAlertRuleMutation, UpdateAlertRuleMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateAlertRuleMutation, UpdateAlertRuleMutationVariables>(UpdateAlertRuleDocument, options);
      }
export type UpdateAlertRuleMutationHookResult = ReturnType<typeof useUpdateAlertRuleMutation>;
export type UpdateAlertRuleMutationResult = Apollo.MutationResult<UpdateAlertRuleMutation>;
export type UpdateAlertRuleMutationOptions = Apollo.BaseMutationOptions<UpdateAlertRuleMutation, UpdateAlertRuleMutationVariables>;
export const DeleteAlertRuleDocument = gql`
    mutation DeleteAlertRule($id: ID!) {
  deleteAlertRule(id: $id)
}
    `;
export type DeleteAlertRuleMutationFn = Apollo.MutationFunction<DeleteAlertRuleMutation, DeleteAlertRuleMutationVariables>;

/**
 * __useDeleteAlertRuleMutation__
 *
 * To run a mutation, you first call `useDeleteAlertRuleMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteAlertRuleMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteAlertRuleMutation, { data, loading, error }] = useDeleteAlertRuleMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteAlertRuleMutation(baseOptions?: Apollo.MutationHookOptions<DeleteAlertRuleMutation, DeleteAlertRuleMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteAlertRuleMutation, DeleteAlertRuleMutationVariables>(DeleteAlertRuleDocument, options);
      }
export type DeleteAlertRuleMutationHookResult = ReturnType<typeof useDeleteAlertRuleMutation>;
export type DeleteAlertRuleMutationResult = Apollo.MutationResult<DeleteAlertRuleMutation>;
export type DeleteAlertRuleMutationOptions = Apollo.BaseMutationOptions<DeleteAlertRuleMutation, DeleteAlertRuleMutationVariables>;
export const ToggleAlertRuleDocument = gql`
    mutation ToggleAlertRule($id: ID!, $enabled: Boolean!) {
  toggleAlertRule(id: $id, enabled: $enabled) {
    id
    enabled
  }
}
    `;
export type ToggleAlertRuleMutationFn = Apollo.MutationFunction<ToggleAlertRuleMutation, ToggleAlertRuleMutationVariables>;

/**
 * __useToggleAlertRuleMutation__
 *
 * To run a mutation, you first call `useToggleAlertRuleMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useToggleAlertRuleMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [toggleAlertRuleMutation, { data, loading, error }] = useToggleAlertRuleMutation({
 *   variables: {
 *      id: // value for 'id'
 *      enabled: // value for 'enabled'
 *   },
 * });
 */
export function useToggleAlertRuleMutation(baseOptions?: Apollo.MutationHookOptions<ToggleAlertRuleMutation, ToggleAlertRuleMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ToggleAlertRuleMutation, ToggleAlertRuleMutationVariables>(ToggleAlertRuleDocument, options);
      }
export type ToggleAlertRuleMutationHookResult = ReturnType<typeof useToggleAlertRuleMutation>;
export type ToggleAlertRuleMutationResult = Apollo.MutationResult<ToggleAlertRuleMutation>;
export type ToggleAlertRuleMutationOptions = Apollo.BaseMutationOptions<ToggleAlertRuleMutation, ToggleAlertRuleMutationVariables>;
export const TestAlertRuleDocument = gql`
    mutation TestAlertRule($id: ID!) {
  testAlertRule(id: $id)
}
    `;
export type TestAlertRuleMutationFn = Apollo.MutationFunction<TestAlertRuleMutation, TestAlertRuleMutationVariables>;

/**
 * __useTestAlertRuleMutation__
 *
 * To run a mutation, you first call `useTestAlertRuleMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useTestAlertRuleMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [testAlertRuleMutation, { data, loading, error }] = useTestAlertRuleMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useTestAlertRuleMutation(baseOptions?: Apollo.MutationHookOptions<TestAlertRuleMutation, TestAlertRuleMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<TestAlertRuleMutation, TestAlertRuleMutationVariables>(TestAlertRuleDocument, options);
      }
export type TestAlertRuleMutationHookResult = ReturnType<typeof useTestAlertRuleMutation>;
export type TestAlertRuleMutationResult = Apollo.MutationResult<TestAlertRuleMutation>;
export type TestAlertRuleMutationOptions = Apollo.BaseMutationOptions<TestAlertRuleMutation, TestAlertRuleMutationVariables>;
export const GetAlertTypesForResourceDocument = gql`
    query GetAlertTypesForResource($resourceType: AlertRuleAlertResourceType!, $resourceID: ID) {
  alertTypesForResource(resourceType: $resourceType, resourceID: $resourceID) {
    type
    label
    description
    defaultSeverity
    conditionFields {
      name
      label
      type
      required
      description
      min
      max
      default
      unit
      options {
        value
        label
      }
    }
  }
}
    `;

/**
 * __useGetAlertTypesForResourceQuery__
 *
 * To run a query within a React component, call `useGetAlertTypesForResourceQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAlertTypesForResourceQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAlertTypesForResourceQuery({
 *   variables: {
 *      resourceType: // value for 'resourceType'
 *      resourceID: // value for 'resourceID'
 *   },
 * });
 */
export function useGetAlertTypesForResourceQuery(baseOptions: Apollo.QueryHookOptions<GetAlertTypesForResourceQuery, GetAlertTypesForResourceQueryVariables> & ({ variables: GetAlertTypesForResourceQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAlertTypesForResourceQuery, GetAlertTypesForResourceQueryVariables>(GetAlertTypesForResourceDocument, options);
      }
export function useGetAlertTypesForResourceLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAlertTypesForResourceQuery, GetAlertTypesForResourceQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAlertTypesForResourceQuery, GetAlertTypesForResourceQueryVariables>(GetAlertTypesForResourceDocument, options);
        }
// @ts-ignore
export function useGetAlertTypesForResourceSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetAlertTypesForResourceQuery, GetAlertTypesForResourceQueryVariables>): Apollo.UseSuspenseQueryResult<GetAlertTypesForResourceQuery, GetAlertTypesForResourceQueryVariables>;
export function useGetAlertTypesForResourceSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetAlertTypesForResourceQuery, GetAlertTypesForResourceQueryVariables>): Apollo.UseSuspenseQueryResult<GetAlertTypesForResourceQuery | undefined, GetAlertTypesForResourceQueryVariables>;
export function useGetAlertTypesForResourceSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetAlertTypesForResourceQuery, GetAlertTypesForResourceQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetAlertTypesForResourceQuery, GetAlertTypesForResourceQueryVariables>(GetAlertTypesForResourceDocument, options);
        }
export type GetAlertTypesForResourceQueryHookResult = ReturnType<typeof useGetAlertTypesForResourceQuery>;
export type GetAlertTypesForResourceLazyQueryHookResult = ReturnType<typeof useGetAlertTypesForResourceLazyQuery>;
export type GetAlertTypesForResourceSuspenseQueryHookResult = ReturnType<typeof useGetAlertTypesForResourceSuspenseQuery>;
export type GetAlertTypesForResourceQueryResult = Apollo.QueryResult<GetAlertTypesForResourceQuery, GetAlertTypesForResourceQueryVariables>;
export const GetAlertEventsDocument = gql`
    query GetAlertEvents($first: Int, $after: Cursor, $where: AlertEventWhereInput, $orderBy: AlertEventOrder) {
  alertEvents(first: $first, after: $after, where: $where, orderBy: $orderBy) {
    edges {
      node {
        id
        status
        alertType
        severity
        subject
        body
        context
        recipients
        channelType
        sentAt
        readAt
        errorMessage
        resourceType
        resourceID
        ownerID
        createdAt
        rule {
          id
          name
        }
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    totalCount
  }
}
    `;

/**
 * __useGetAlertEventsQuery__
 *
 * To run a query within a React component, call `useGetAlertEventsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAlertEventsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAlertEventsQuery({
 *   variables: {
 *      first: // value for 'first'
 *      after: // value for 'after'
 *      where: // value for 'where'
 *      orderBy: // value for 'orderBy'
 *   },
 * });
 */
export function useGetAlertEventsQuery(baseOptions?: Apollo.QueryHookOptions<GetAlertEventsQuery, GetAlertEventsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAlertEventsQuery, GetAlertEventsQueryVariables>(GetAlertEventsDocument, options);
      }
export function useGetAlertEventsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAlertEventsQuery, GetAlertEventsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAlertEventsQuery, GetAlertEventsQueryVariables>(GetAlertEventsDocument, options);
        }
// @ts-ignore
export function useGetAlertEventsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetAlertEventsQuery, GetAlertEventsQueryVariables>): Apollo.UseSuspenseQueryResult<GetAlertEventsQuery, GetAlertEventsQueryVariables>;
export function useGetAlertEventsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetAlertEventsQuery, GetAlertEventsQueryVariables>): Apollo.UseSuspenseQueryResult<GetAlertEventsQuery | undefined, GetAlertEventsQueryVariables>;
export function useGetAlertEventsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetAlertEventsQuery, GetAlertEventsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetAlertEventsQuery, GetAlertEventsQueryVariables>(GetAlertEventsDocument, options);
        }
export type GetAlertEventsQueryHookResult = ReturnType<typeof useGetAlertEventsQuery>;
export type GetAlertEventsLazyQueryHookResult = ReturnType<typeof useGetAlertEventsLazyQuery>;
export type GetAlertEventsSuspenseQueryHookResult = ReturnType<typeof useGetAlertEventsSuspenseQuery>;
export type GetAlertEventsQueryResult = Apollo.QueryResult<GetAlertEventsQuery, GetAlertEventsQueryVariables>;
export const GetUnreadAlertCountDocument = gql`
    query GetUnreadAlertCount($where: AlertEventWhereInput) {
  alertEvents(first: 0, where: $where) {
    totalCount
  }
}
    `;

/**
 * __useGetUnreadAlertCountQuery__
 *
 * To run a query within a React component, call `useGetUnreadAlertCountQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetUnreadAlertCountQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetUnreadAlertCountQuery({
 *   variables: {
 *      where: // value for 'where'
 *   },
 * });
 */
export function useGetUnreadAlertCountQuery(baseOptions?: Apollo.QueryHookOptions<GetUnreadAlertCountQuery, GetUnreadAlertCountQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetUnreadAlertCountQuery, GetUnreadAlertCountQueryVariables>(GetUnreadAlertCountDocument, options);
      }
export function useGetUnreadAlertCountLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetUnreadAlertCountQuery, GetUnreadAlertCountQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetUnreadAlertCountQuery, GetUnreadAlertCountQueryVariables>(GetUnreadAlertCountDocument, options);
        }
// @ts-ignore
export function useGetUnreadAlertCountSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetUnreadAlertCountQuery, GetUnreadAlertCountQueryVariables>): Apollo.UseSuspenseQueryResult<GetUnreadAlertCountQuery, GetUnreadAlertCountQueryVariables>;
export function useGetUnreadAlertCountSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetUnreadAlertCountQuery, GetUnreadAlertCountQueryVariables>): Apollo.UseSuspenseQueryResult<GetUnreadAlertCountQuery | undefined, GetUnreadAlertCountQueryVariables>;
export function useGetUnreadAlertCountSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetUnreadAlertCountQuery, GetUnreadAlertCountQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetUnreadAlertCountQuery, GetUnreadAlertCountQueryVariables>(GetUnreadAlertCountDocument, options);
        }
export type GetUnreadAlertCountQueryHookResult = ReturnType<typeof useGetUnreadAlertCountQuery>;
export type GetUnreadAlertCountLazyQueryHookResult = ReturnType<typeof useGetUnreadAlertCountLazyQuery>;
export type GetUnreadAlertCountSuspenseQueryHookResult = ReturnType<typeof useGetUnreadAlertCountSuspenseQuery>;
export type GetUnreadAlertCountQueryResult = Apollo.QueryResult<GetUnreadAlertCountQuery, GetUnreadAlertCountQueryVariables>;
export const MarkAlertEventAsReadDocument = gql`
    mutation MarkAlertEventAsRead($id: ID!, $ownerID: String!) {
  markAlertEventAsRead(id: $id, ownerID: $ownerID) {
    id
    readAt
  }
}
    `;
export type MarkAlertEventAsReadMutationFn = Apollo.MutationFunction<MarkAlertEventAsReadMutation, MarkAlertEventAsReadMutationVariables>;

/**
 * __useMarkAlertEventAsReadMutation__
 *
 * To run a mutation, you first call `useMarkAlertEventAsReadMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useMarkAlertEventAsReadMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [markAlertEventAsReadMutation, { data, loading, error }] = useMarkAlertEventAsReadMutation({
 *   variables: {
 *      id: // value for 'id'
 *      ownerID: // value for 'ownerID'
 *   },
 * });
 */
export function useMarkAlertEventAsReadMutation(baseOptions?: Apollo.MutationHookOptions<MarkAlertEventAsReadMutation, MarkAlertEventAsReadMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<MarkAlertEventAsReadMutation, MarkAlertEventAsReadMutationVariables>(MarkAlertEventAsReadDocument, options);
      }
export type MarkAlertEventAsReadMutationHookResult = ReturnType<typeof useMarkAlertEventAsReadMutation>;
export type MarkAlertEventAsReadMutationResult = Apollo.MutationResult<MarkAlertEventAsReadMutation>;
export type MarkAlertEventAsReadMutationOptions = Apollo.BaseMutationOptions<MarkAlertEventAsReadMutation, MarkAlertEventAsReadMutationVariables>;
export const MarkAllAlertEventsAsReadDocument = gql`
    mutation MarkAllAlertEventsAsRead($ownerID: String!) {
  markAllAlertEventsAsRead(ownerID: $ownerID)
}
    `;
export type MarkAllAlertEventsAsReadMutationFn = Apollo.MutationFunction<MarkAllAlertEventsAsReadMutation, MarkAllAlertEventsAsReadMutationVariables>;

/**
 * __useMarkAllAlertEventsAsReadMutation__
 *
 * To run a mutation, you first call `useMarkAllAlertEventsAsReadMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useMarkAllAlertEventsAsReadMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [markAllAlertEventsAsReadMutation, { data, loading, error }] = useMarkAllAlertEventsAsReadMutation({
 *   variables: {
 *      ownerID: // value for 'ownerID'
 *   },
 * });
 */
export function useMarkAllAlertEventsAsReadMutation(baseOptions?: Apollo.MutationHookOptions<MarkAllAlertEventsAsReadMutation, MarkAllAlertEventsAsReadMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<MarkAllAlertEventsAsReadMutation, MarkAllAlertEventsAsReadMutationVariables>(MarkAllAlertEventsAsReadDocument, options);
      }
export type MarkAllAlertEventsAsReadMutationHookResult = ReturnType<typeof useMarkAllAlertEventsAsReadMutation>;
export type MarkAllAlertEventsAsReadMutationResult = Apollo.MutationResult<MarkAllAlertEventsAsReadMutation>;
export type MarkAllAlertEventsAsReadMutationOptions = Apollo.BaseMutationOptions<MarkAllAlertEventsAsReadMutation, MarkAllAlertEventsAsReadMutationVariables>;