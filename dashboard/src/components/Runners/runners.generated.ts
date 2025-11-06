import * as Types from '../../generated/types';

import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
const defaultOptions = {} as const;
export type GetRunnersQueryVariables = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['Cursor']['input']>;
}>;


export type GetRunnersQuery = { __typename?: 'Query', botRunners: { __typename?: 'BotRunnerConnection', totalCount: number, edges?: Array<{ __typename?: 'BotRunnerEdge', node?: { __typename?: 'BotRunner', id: string, name: string, type: Types.BotRunnerRunnerType, createdAt: string, dataIsReady: boolean, dataLastUpdated?: string | null, dataDownloadStatus: Types.BotRunnerDataDownloadStatus, dataDownloadProgress?: Record<string, any> | null, dataDownloadConfig?: Record<string, any> | null, dataErrorMessage?: string | null, bots: { __typename?: 'BotConnection', totalCount: number } } | null } | null> | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type GetRunnerQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type GetRunnerQuery = { __typename?: 'Query', node?:
    | { __typename?: 'Backtest' }
    | { __typename?: 'Bot' }
    | { __typename?: 'BotMetrics' }
    | { __typename?: 'BotRunner', id: string, name: string, type: Types.BotRunnerRunnerType, createdAt: string, dataIsReady: boolean, dataLastUpdated?: string | null, dataDownloadStatus: Types.BotRunnerDataDownloadStatus, dataDownloadProgress?: Record<string, any> | null, dataDownloadConfig?: Record<string, any> | null, dataErrorMessage?: string | null, bots: { __typename?: 'BotConnection', totalCount: number } }
    | { __typename?: 'Exchange' }
    | { __typename?: 'Strategy' }
    | { __typename?: 'Trade' }
   | null };

export type CreateRunnerMutationVariables = Types.Exact<{
  input: Types.CreateBotRunnerInput;
}>;


export type CreateRunnerMutation = { __typename?: 'Mutation', createBotRunner: { __typename?: 'BotRunner', id: string, name: string, type: Types.BotRunnerRunnerType, dataDownloadConfig?: Record<string, any> | null } };

export type UpdateRunnerMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.UpdateBotRunnerInput;
}>;


export type UpdateRunnerMutation = { __typename?: 'Mutation', updateBotRunner: { __typename?: 'BotRunner', id: string, name: string, type: Types.BotRunnerRunnerType, dataDownloadConfig?: Record<string, any> | null } };

export type DeleteRunnerMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type DeleteRunnerMutation = { __typename?: 'Mutation', deleteBotRunner: boolean };

export type RefreshRunnerDataMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type RefreshRunnerDataMutation = { __typename?: 'Mutation', refreshRunnerData: { __typename?: 'BotRunner', id: string, name: string, type: Types.BotRunnerRunnerType, dataIsReady: boolean, dataLastUpdated?: string | null, dataDownloadStatus: Types.BotRunnerDataDownloadStatus, dataDownloadProgress?: Record<string, any> | null, dataErrorMessage?: string | null } };


export const GetRunnersDocument = gql`
    query GetRunners($first: Int, $after: Cursor) {
  botRunners(first: $first, after: $after) {
    edges {
      node {
        id
        name
        type
        createdAt
        dataIsReady
        dataLastUpdated
        dataDownloadStatus
        dataDownloadProgress
        dataDownloadConfig
        dataErrorMessage
        bots {
          totalCount
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
 * __useGetRunnersQuery__
 *
 * To run a query within a React component, call `useGetRunnersQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetRunnersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetRunnersQuery({
 *   variables: {
 *      first: // value for 'first'
 *      after: // value for 'after'
 *   },
 * });
 */
export function useGetRunnersQuery(baseOptions?: Apollo.QueryHookOptions<GetRunnersQuery, GetRunnersQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetRunnersQuery, GetRunnersQueryVariables>(GetRunnersDocument, options);
      }
export function useGetRunnersLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetRunnersQuery, GetRunnersQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetRunnersQuery, GetRunnersQueryVariables>(GetRunnersDocument, options);
        }
export function useGetRunnersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetRunnersQuery, GetRunnersQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetRunnersQuery, GetRunnersQueryVariables>(GetRunnersDocument, options);
        }
export type GetRunnersQueryHookResult = ReturnType<typeof useGetRunnersQuery>;
export type GetRunnersLazyQueryHookResult = ReturnType<typeof useGetRunnersLazyQuery>;
export type GetRunnersSuspenseQueryHookResult = ReturnType<typeof useGetRunnersSuspenseQuery>;
export type GetRunnersQueryResult = Apollo.QueryResult<GetRunnersQuery, GetRunnersQueryVariables>;
export const GetRunnerDocument = gql`
    query GetRunner($id: ID!) {
  node(id: $id) {
    ... on BotRunner {
      id
      name
      type
      createdAt
      dataIsReady
      dataLastUpdated
      dataDownloadStatus
      dataDownloadProgress
      dataDownloadConfig
      dataErrorMessage
      bots {
        totalCount
      }
    }
  }
}
    `;

/**
 * __useGetRunnerQuery__
 *
 * To run a query within a React component, call `useGetRunnerQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetRunnerQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetRunnerQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetRunnerQuery(baseOptions: Apollo.QueryHookOptions<GetRunnerQuery, GetRunnerQueryVariables> & ({ variables: GetRunnerQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetRunnerQuery, GetRunnerQueryVariables>(GetRunnerDocument, options);
      }
export function useGetRunnerLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetRunnerQuery, GetRunnerQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetRunnerQuery, GetRunnerQueryVariables>(GetRunnerDocument, options);
        }
export function useGetRunnerSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetRunnerQuery, GetRunnerQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetRunnerQuery, GetRunnerQueryVariables>(GetRunnerDocument, options);
        }
export type GetRunnerQueryHookResult = ReturnType<typeof useGetRunnerQuery>;
export type GetRunnerLazyQueryHookResult = ReturnType<typeof useGetRunnerLazyQuery>;
export type GetRunnerSuspenseQueryHookResult = ReturnType<typeof useGetRunnerSuspenseQuery>;
export type GetRunnerQueryResult = Apollo.QueryResult<GetRunnerQuery, GetRunnerQueryVariables>;
export const CreateRunnerDocument = gql`
    mutation CreateRunner($input: CreateBotRunnerInput!) {
  createBotRunner(input: $input) {
    id
    name
    type
    dataDownloadConfig
  }
}
    `;
export type CreateRunnerMutationFn = Apollo.MutationFunction<CreateRunnerMutation, CreateRunnerMutationVariables>;

/**
 * __useCreateRunnerMutation__
 *
 * To run a mutation, you first call `useCreateRunnerMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateRunnerMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createRunnerMutation, { data, loading, error }] = useCreateRunnerMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateRunnerMutation(baseOptions?: Apollo.MutationHookOptions<CreateRunnerMutation, CreateRunnerMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateRunnerMutation, CreateRunnerMutationVariables>(CreateRunnerDocument, options);
      }
export type CreateRunnerMutationHookResult = ReturnType<typeof useCreateRunnerMutation>;
export type CreateRunnerMutationResult = Apollo.MutationResult<CreateRunnerMutation>;
export type CreateRunnerMutationOptions = Apollo.BaseMutationOptions<CreateRunnerMutation, CreateRunnerMutationVariables>;
export const UpdateRunnerDocument = gql`
    mutation UpdateRunner($id: ID!, $input: UpdateBotRunnerInput!) {
  updateBotRunner(id: $id, input: $input) {
    id
    name
    type
    dataDownloadConfig
  }
}
    `;
export type UpdateRunnerMutationFn = Apollo.MutationFunction<UpdateRunnerMutation, UpdateRunnerMutationVariables>;

/**
 * __useUpdateRunnerMutation__
 *
 * To run a mutation, you first call `useUpdateRunnerMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateRunnerMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateRunnerMutation, { data, loading, error }] = useUpdateRunnerMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateRunnerMutation(baseOptions?: Apollo.MutationHookOptions<UpdateRunnerMutation, UpdateRunnerMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateRunnerMutation, UpdateRunnerMutationVariables>(UpdateRunnerDocument, options);
      }
export type UpdateRunnerMutationHookResult = ReturnType<typeof useUpdateRunnerMutation>;
export type UpdateRunnerMutationResult = Apollo.MutationResult<UpdateRunnerMutation>;
export type UpdateRunnerMutationOptions = Apollo.BaseMutationOptions<UpdateRunnerMutation, UpdateRunnerMutationVariables>;
export const DeleteRunnerDocument = gql`
    mutation DeleteRunner($id: ID!) {
  deleteBotRunner(id: $id)
}
    `;
export type DeleteRunnerMutationFn = Apollo.MutationFunction<DeleteRunnerMutation, DeleteRunnerMutationVariables>;

/**
 * __useDeleteRunnerMutation__
 *
 * To run a mutation, you first call `useDeleteRunnerMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteRunnerMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteRunnerMutation, { data, loading, error }] = useDeleteRunnerMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteRunnerMutation(baseOptions?: Apollo.MutationHookOptions<DeleteRunnerMutation, DeleteRunnerMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteRunnerMutation, DeleteRunnerMutationVariables>(DeleteRunnerDocument, options);
      }
export type DeleteRunnerMutationHookResult = ReturnType<typeof useDeleteRunnerMutation>;
export type DeleteRunnerMutationResult = Apollo.MutationResult<DeleteRunnerMutation>;
export type DeleteRunnerMutationOptions = Apollo.BaseMutationOptions<DeleteRunnerMutation, DeleteRunnerMutationVariables>;
export const RefreshRunnerDataDocument = gql`
    mutation RefreshRunnerData($id: ID!) {
  refreshRunnerData(id: $id) {
    id
    name
    type
    dataIsReady
    dataLastUpdated
    dataDownloadStatus
    dataDownloadProgress
    dataErrorMessage
  }
}
    `;
export type RefreshRunnerDataMutationFn = Apollo.MutationFunction<RefreshRunnerDataMutation, RefreshRunnerDataMutationVariables>;

/**
 * __useRefreshRunnerDataMutation__
 *
 * To run a mutation, you first call `useRefreshRunnerDataMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRefreshRunnerDataMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [refreshRunnerDataMutation, { data, loading, error }] = useRefreshRunnerDataMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useRefreshRunnerDataMutation(baseOptions?: Apollo.MutationHookOptions<RefreshRunnerDataMutation, RefreshRunnerDataMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RefreshRunnerDataMutation, RefreshRunnerDataMutationVariables>(RefreshRunnerDataDocument, options);
      }
export type RefreshRunnerDataMutationHookResult = ReturnType<typeof useRefreshRunnerDataMutation>;
export type RefreshRunnerDataMutationResult = Apollo.MutationResult<RefreshRunnerDataMutation>;
export type RefreshRunnerDataMutationOptions = Apollo.BaseMutationOptions<RefreshRunnerDataMutation, RefreshRunnerDataMutationVariables>;