import * as Types from '../../generated/types';

import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
const defaultOptions = {} as const;
export type GetRunnersQueryVariables = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['Cursor']['input']>;
  where?: Types.InputMaybe<Types.BotRunnerWhereInput>;
}>;


export type GetRunnersQuery = { __typename?: 'Query', botRunners: { __typename?: 'BotRunnerConnection', totalCount: number, edges?: Array<{ __typename?: 'BotRunnerEdge', node?: { __typename?: 'BotRunner', id: string, name: string, type: Types.BotRunnerRunnerType, ownerID: string, public: boolean, createdAt: string, dataIsReady: boolean, dataLastUpdated?: string | null, dataDownloadStatus: Types.BotRunnerDataDownloadStatus, dataDownloadProgress?: Record<string, any> | null, dataErrorMessage?: string | null, billingEnabled: boolean, bots: { __typename?: 'BotConnection', totalCount: number } } | null } | null> | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type GetRunnerWithSecretsQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type GetRunnerWithSecretsQuery = { __typename?: 'Query', botRunners: { __typename?: 'BotRunnerConnection', edges?: Array<{ __typename?: 'BotRunnerEdge', node?: { __typename?: 'BotRunner', id: string, name: string, type: Types.BotRunnerRunnerType, config?: Record<string, any> | null, s3Config?: Record<string, any> | null, s3DataKey?: string | null, s3DataUploadedAt?: string | null, createdAt: string, dataIsReady: boolean, dataLastUpdated?: string | null, dataDownloadStatus: Types.BotRunnerDataDownloadStatus, dataDownloadProgress?: Record<string, any> | null, dataDownloadConfig?: Record<string, any> | null, dataErrorMessage?: string | null, billingEnabled: boolean, cpuPricePerCoreHour?: number | null, memoryPricePerGBHour?: number | null, networkPricePerGB?: number | null, storagePricePerGB?: number | null, bots: { __typename?: 'BotConnection', totalCount: number } } | null } | null> | null } };

export type CreateRunnerMutationVariables = Types.Exact<{
  input: Types.CreateBotRunnerInput;
}>;


export type CreateRunnerMutation = { __typename?: 'Mutation', createBotRunner: { __typename?: 'BotRunner', id: string, name: string, type: Types.BotRunnerRunnerType, config?: Record<string, any> | null, dataDownloadConfig?: Record<string, any> | null, billingEnabled: boolean, cpuPricePerCoreHour?: number | null, memoryPricePerGBHour?: number | null, networkPricePerGB?: number | null, storagePricePerGB?: number | null } };

export type UpdateRunnerMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.UpdateBotRunnerInput;
}>;


export type UpdateRunnerMutation = { __typename?: 'Mutation', updateBotRunner: { __typename?: 'BotRunner', id: string, name: string, type: Types.BotRunnerRunnerType, config?: Record<string, any> | null, dataDownloadConfig?: Record<string, any> | null, billingEnabled: boolean, cpuPricePerCoreHour?: number | null, memoryPricePerGBHour?: number | null, networkPricePerGB?: number | null, storagePricePerGB?: number | null } };

export type DeleteRunnerMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type DeleteRunnerMutation = { __typename?: 'Mutation', deleteBotRunner: boolean };

export type RefreshRunnerDataMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type RefreshRunnerDataMutation = { __typename?: 'Mutation', refreshRunnerData: { __typename?: 'BotRunner', id: string, name: string, type: Types.BotRunnerRunnerType, dataIsReady: boolean, dataLastUpdated?: string | null, dataDownloadStatus: Types.BotRunnerDataDownloadStatus, dataDownloadProgress?: Record<string, any> | null, dataErrorMessage?: string | null } };

export type TestRunnerConnectionMutationVariables = Types.Exact<{
  type: Types.BotRunnerRunnerType;
  config: Types.RunnerConfigInput;
}>;


export type TestRunnerConnectionMutation = { __typename?: 'Mutation', testRunnerConnection: { __typename?: 'ConnectionTestResult', success: boolean, message: string, version?: string | null } };

export type SetRunnerVisibilityMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  public: Types.Scalars['Boolean']['input'];
}>;


export type SetRunnerVisibilityMutation = { __typename?: 'Mutation', setRunnerVisibility: { __typename?: 'BotRunner', id: string, name: string, public: boolean } };

export type TestS3ConnectionMutationVariables = Types.Exact<{
  config: Types.S3ConfigInput;
}>;


export type TestS3ConnectionMutation = { __typename?: 'Mutation', testS3Connection: { __typename?: 'ConnectionTestResult', success: boolean, message: string } };


export const GetRunnersDocument = gql`
    query GetRunners($first: Int, $after: Cursor, $where: BotRunnerWhereInput) {
  botRunners(first: $first, after: $after, where: $where) {
    edges {
      node {
        id
        name
        type
        ownerID
        public
        createdAt
        dataIsReady
        dataLastUpdated
        dataDownloadStatus
        dataDownloadProgress
        dataErrorMessage
        billingEnabled
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
 *      where: // value for 'where'
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
export const GetRunnerWithSecretsDocument = gql`
    query GetRunnerWithSecrets($id: ID!) {
  botRunners(where: {id: $id}) {
    edges {
      node {
        id
        name
        type
        config
        s3Config
        s3DataKey
        s3DataUploadedAt
        createdAt
        dataIsReady
        dataLastUpdated
        dataDownloadStatus
        dataDownloadProgress
        dataDownloadConfig
        dataErrorMessage
        billingEnabled
        cpuPricePerCoreHour
        memoryPricePerGBHour
        networkPricePerGB
        storagePricePerGB
        bots {
          totalCount
        }
      }
    }
  }
}
    `;

/**
 * __useGetRunnerWithSecretsQuery__
 *
 * To run a query within a React component, call `useGetRunnerWithSecretsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetRunnerWithSecretsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetRunnerWithSecretsQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetRunnerWithSecretsQuery(baseOptions: Apollo.QueryHookOptions<GetRunnerWithSecretsQuery, GetRunnerWithSecretsQueryVariables> & ({ variables: GetRunnerWithSecretsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetRunnerWithSecretsQuery, GetRunnerWithSecretsQueryVariables>(GetRunnerWithSecretsDocument, options);
      }
export function useGetRunnerWithSecretsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetRunnerWithSecretsQuery, GetRunnerWithSecretsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetRunnerWithSecretsQuery, GetRunnerWithSecretsQueryVariables>(GetRunnerWithSecretsDocument, options);
        }
export function useGetRunnerWithSecretsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetRunnerWithSecretsQuery, GetRunnerWithSecretsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetRunnerWithSecretsQuery, GetRunnerWithSecretsQueryVariables>(GetRunnerWithSecretsDocument, options);
        }
export type GetRunnerWithSecretsQueryHookResult = ReturnType<typeof useGetRunnerWithSecretsQuery>;
export type GetRunnerWithSecretsLazyQueryHookResult = ReturnType<typeof useGetRunnerWithSecretsLazyQuery>;
export type GetRunnerWithSecretsSuspenseQueryHookResult = ReturnType<typeof useGetRunnerWithSecretsSuspenseQuery>;
export type GetRunnerWithSecretsQueryResult = Apollo.QueryResult<GetRunnerWithSecretsQuery, GetRunnerWithSecretsQueryVariables>;
export const CreateRunnerDocument = gql`
    mutation CreateRunner($input: CreateBotRunnerInput!) {
  createBotRunner(input: $input) {
    id
    name
    type
    config
    dataDownloadConfig
    billingEnabled
    cpuPricePerCoreHour
    memoryPricePerGBHour
    networkPricePerGB
    storagePricePerGB
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
    config
    dataDownloadConfig
    billingEnabled
    cpuPricePerCoreHour
    memoryPricePerGBHour
    networkPricePerGB
    storagePricePerGB
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
export const TestRunnerConnectionDocument = gql`
    mutation TestRunnerConnection($type: BotRunnerRunnerType!, $config: RunnerConfigInput!) {
  testRunnerConnection(type: $type, config: $config) {
    success
    message
    version
  }
}
    `;
export type TestRunnerConnectionMutationFn = Apollo.MutationFunction<TestRunnerConnectionMutation, TestRunnerConnectionMutationVariables>;

/**
 * __useTestRunnerConnectionMutation__
 *
 * To run a mutation, you first call `useTestRunnerConnectionMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useTestRunnerConnectionMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [testRunnerConnectionMutation, { data, loading, error }] = useTestRunnerConnectionMutation({
 *   variables: {
 *      type: // value for 'type'
 *      config: // value for 'config'
 *   },
 * });
 */
export function useTestRunnerConnectionMutation(baseOptions?: Apollo.MutationHookOptions<TestRunnerConnectionMutation, TestRunnerConnectionMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<TestRunnerConnectionMutation, TestRunnerConnectionMutationVariables>(TestRunnerConnectionDocument, options);
      }
export type TestRunnerConnectionMutationHookResult = ReturnType<typeof useTestRunnerConnectionMutation>;
export type TestRunnerConnectionMutationResult = Apollo.MutationResult<TestRunnerConnectionMutation>;
export type TestRunnerConnectionMutationOptions = Apollo.BaseMutationOptions<TestRunnerConnectionMutation, TestRunnerConnectionMutationVariables>;
export const SetRunnerVisibilityDocument = gql`
    mutation SetRunnerVisibility($id: ID!, $public: Boolean!) {
  setRunnerVisibility(id: $id, public: $public) {
    id
    name
    public
  }
}
    `;
export type SetRunnerVisibilityMutationFn = Apollo.MutationFunction<SetRunnerVisibilityMutation, SetRunnerVisibilityMutationVariables>;

/**
 * __useSetRunnerVisibilityMutation__
 *
 * To run a mutation, you first call `useSetRunnerVisibilityMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useSetRunnerVisibilityMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [setRunnerVisibilityMutation, { data, loading, error }] = useSetRunnerVisibilityMutation({
 *   variables: {
 *      id: // value for 'id'
 *      public: // value for 'public'
 *   },
 * });
 */
export function useSetRunnerVisibilityMutation(baseOptions?: Apollo.MutationHookOptions<SetRunnerVisibilityMutation, SetRunnerVisibilityMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<SetRunnerVisibilityMutation, SetRunnerVisibilityMutationVariables>(SetRunnerVisibilityDocument, options);
      }
export type SetRunnerVisibilityMutationHookResult = ReturnType<typeof useSetRunnerVisibilityMutation>;
export type SetRunnerVisibilityMutationResult = Apollo.MutationResult<SetRunnerVisibilityMutation>;
export type SetRunnerVisibilityMutationOptions = Apollo.BaseMutationOptions<SetRunnerVisibilityMutation, SetRunnerVisibilityMutationVariables>;
export const TestS3ConnectionDocument = gql`
    mutation TestS3Connection($config: S3ConfigInput!) {
  testS3Connection(config: $config) {
    success
    message
  }
}
    `;
export type TestS3ConnectionMutationFn = Apollo.MutationFunction<TestS3ConnectionMutation, TestS3ConnectionMutationVariables>;

/**
 * __useTestS3ConnectionMutation__
 *
 * To run a mutation, you first call `useTestS3ConnectionMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useTestS3ConnectionMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [testS3ConnectionMutation, { data, loading, error }] = useTestS3ConnectionMutation({
 *   variables: {
 *      config: // value for 'config'
 *   },
 * });
 */
export function useTestS3ConnectionMutation(baseOptions?: Apollo.MutationHookOptions<TestS3ConnectionMutation, TestS3ConnectionMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<TestS3ConnectionMutation, TestS3ConnectionMutationVariables>(TestS3ConnectionDocument, options);
      }
export type TestS3ConnectionMutationHookResult = ReturnType<typeof useTestS3ConnectionMutation>;
export type TestS3ConnectionMutationResult = Apollo.MutationResult<TestS3ConnectionMutation>;
export type TestS3ConnectionMutationOptions = Apollo.BaseMutationOptions<TestS3ConnectionMutation, TestS3ConnectionMutationVariables>;