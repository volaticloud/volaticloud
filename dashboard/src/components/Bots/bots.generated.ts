import * as Types from '../../generated/types';

import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
const defaultOptions = {} as const;
export type GetBotsQueryVariables = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['Cursor']['input']>;
  where?: Types.InputMaybe<Types.BotWhereInput>;
}>;


export type GetBotsQuery = { __typename?: 'Query', bots: { __typename?: 'BotConnection', totalCount: number, edges?: Array<{ __typename?: 'BotEdge', node?: { __typename?: 'Bot', id: string, name: string, status: Types.BotBotStatus, mode: Types.BotBotMode, containerID?: string | null, freqtradeVersion: string, lastSeenAt?: string | null, errorMessage?: string | null, createdAt: string, config?: Record<string, any> | null, ownerID: string, public: boolean, exchange: { __typename?: 'Exchange', id: string, name: string }, strategy: { __typename?: 'Strategy', id: string, name: string }, runner: { __typename?: 'BotRunner', id: string, name: string, type: Types.BotRunnerRunnerType } } | null } | null> | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type GetBotQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type GetBotQuery = { __typename?: 'Query', bots: { __typename?: 'BotConnection', edges?: Array<{ __typename?: 'BotEdge', node?: { __typename?: 'Bot', id: string, name: string, status: Types.BotBotStatus, mode: Types.BotBotMode, containerID?: string | null, freqtradeVersion: string, lastSeenAt?: string | null, errorMessage?: string | null, createdAt: string, updatedAt: string, config?: Record<string, any> | null, exchange: { __typename?: 'Exchange', id: string, name: string }, strategy: { __typename?: 'Strategy', id: string, name: string, description?: string | null }, runner: { __typename?: 'BotRunner', id: string, name: string, type: Types.BotRunnerRunnerType }, metrics?: { __typename?: 'BotMetrics', id: string, profitClosedCoin?: number | null, profitClosedPercent?: number | null, profitAllCoin?: number | null, profitAllPercent?: number | null, tradeCount?: number | null, closedTradeCount?: number | null, openTradeCount?: number | null, winningTrades?: number | null, losingTrades?: number | null, winrate?: number | null, expectancy?: number | null, profitFactor?: number | null, maxDrawdown?: number | null, maxDrawdownAbs?: number | null, bestPair?: string | null, bestRate?: number | null, firstTradeTimestamp?: string | null, latestTradeTimestamp?: string | null, fetchedAt: string, updatedAt: string } | null, trades: { __typename?: 'TradeConnection', totalCount: number, edges?: Array<{ __typename?: 'TradeEdge', node?: { __typename?: 'Trade', id: string, pair: string, isOpen: boolean, openDate: string, closeDate?: string | null, profitAbs: number, profitRatio: number } | null } | null> | null } } | null } | null> | null } };

export type GetBotRunnerStatusQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type GetBotRunnerStatusQuery = { __typename?: 'Query', getBotRunnerStatus?: { __typename?: 'BotStatus', botID: string, status: Types.BotBotStatus, containerID: string, healthy: boolean, lastSeenAt?: string | null, cpuUsage: number, memoryUsage: number, ipAddress: string, hostPort: number, errorMessage: string, createdAt: string, startedAt?: string | null, stoppedAt?: string | null } | null };

export type CreateBotMutationVariables = Types.Exact<{
  input: Types.CreateBotInput;
}>;


export type CreateBotMutation = { __typename?: 'Mutation', createBot: { __typename?: 'Bot', id: string, name: string, status: Types.BotBotStatus, mode: Types.BotBotMode, freqtradeVersion: string, config?: Record<string, any> | null } };

export type UpdateBotMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.UpdateBotInput;
}>;


export type UpdateBotMutation = { __typename?: 'Mutation', updateBot: { __typename?: 'Bot', id: string, name: string, status: Types.BotBotStatus, mode: Types.BotBotMode, config?: Record<string, any> | null } };

export type DeleteBotMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type DeleteBotMutation = { __typename?: 'Mutation', deleteBot: boolean };

export type StartBotMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type StartBotMutation = { __typename?: 'Mutation', startBot: { __typename?: 'Bot', id: string, name: string, status: Types.BotBotStatus } };

export type StopBotMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type StopBotMutation = { __typename?: 'Mutation', stopBot: { __typename?: 'Bot', id: string, name: string, status: Types.BotBotStatus } };

export type RestartBotMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type RestartBotMutation = { __typename?: 'Mutation', restartBot: { __typename?: 'Bot', id: string, name: string, status: Types.BotBotStatus } };

export type SetBotVisibilityMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  public: Types.Scalars['Boolean']['input'];
}>;


export type SetBotVisibilityMutation = { __typename?: 'Mutation', setBotVisibility: { __typename?: 'Bot', id: string, name: string, public: boolean } };

export type GetFreqtradeTokenMutationVariables = Types.Exact<{
  botId: Types.Scalars['ID']['input'];
}>;


export type GetFreqtradeTokenMutation = { __typename?: 'Mutation', getFreqtradeToken: { __typename?: 'FreqtradeToken', apiUrl: string, username: string, accessToken: string, refreshToken: string } };


export const GetBotsDocument = gql`
    query GetBots($first: Int, $after: Cursor, $where: BotWhereInput) {
  bots(first: $first, after: $after, where: $where) {
    edges {
      node {
        id
        name
        status
        mode
        containerID
        freqtradeVersion
        lastSeenAt
        errorMessage
        createdAt
        config
        ownerID
        public
        exchange {
          id
          name
        }
        strategy {
          id
          name
        }
        runner {
          id
          name
          type
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
 * __useGetBotsQuery__
 *
 * To run a query within a React component, call `useGetBotsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetBotsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetBotsQuery({
 *   variables: {
 *      first: // value for 'first'
 *      after: // value for 'after'
 *      where: // value for 'where'
 *   },
 * });
 */
export function useGetBotsQuery(baseOptions?: Apollo.QueryHookOptions<GetBotsQuery, GetBotsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetBotsQuery, GetBotsQueryVariables>(GetBotsDocument, options);
      }
export function useGetBotsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetBotsQuery, GetBotsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetBotsQuery, GetBotsQueryVariables>(GetBotsDocument, options);
        }
export function useGetBotsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetBotsQuery, GetBotsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetBotsQuery, GetBotsQueryVariables>(GetBotsDocument, options);
        }
export type GetBotsQueryHookResult = ReturnType<typeof useGetBotsQuery>;
export type GetBotsLazyQueryHookResult = ReturnType<typeof useGetBotsLazyQuery>;
export type GetBotsSuspenseQueryHookResult = ReturnType<typeof useGetBotsSuspenseQuery>;
export type GetBotsQueryResult = Apollo.QueryResult<GetBotsQuery, GetBotsQueryVariables>;
export const GetBotDocument = gql`
    query GetBot($id: ID!) {
  bots(where: {id: $id}, first: 1) {
    edges {
      node {
        id
        name
        status
        mode
        containerID
        freqtradeVersion
        lastSeenAt
        errorMessage
        createdAt
        updatedAt
        config
        exchange {
          id
          name
        }
        strategy {
          id
          name
          description
        }
        runner {
          id
          name
          type
        }
        metrics {
          id
          profitClosedCoin
          profitClosedPercent
          profitAllCoin
          profitAllPercent
          tradeCount
          closedTradeCount
          openTradeCount
          winningTrades
          losingTrades
          winrate
          expectancy
          profitFactor
          maxDrawdown
          maxDrawdownAbs
          bestPair
          bestRate
          firstTradeTimestamp
          latestTradeTimestamp
          fetchedAt
          updatedAt
        }
        trades(first: 10) {
          edges {
            node {
              id
              pair
              isOpen
              openDate
              closeDate
              profitAbs
              profitRatio
            }
          }
          totalCount
        }
      }
    }
  }
}
    `;

/**
 * __useGetBotQuery__
 *
 * To run a query within a React component, call `useGetBotQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetBotQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetBotQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetBotQuery(baseOptions: Apollo.QueryHookOptions<GetBotQuery, GetBotQueryVariables> & ({ variables: GetBotQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetBotQuery, GetBotQueryVariables>(GetBotDocument, options);
      }
export function useGetBotLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetBotQuery, GetBotQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetBotQuery, GetBotQueryVariables>(GetBotDocument, options);
        }
export function useGetBotSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetBotQuery, GetBotQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetBotQuery, GetBotQueryVariables>(GetBotDocument, options);
        }
export type GetBotQueryHookResult = ReturnType<typeof useGetBotQuery>;
export type GetBotLazyQueryHookResult = ReturnType<typeof useGetBotLazyQuery>;
export type GetBotSuspenseQueryHookResult = ReturnType<typeof useGetBotSuspenseQuery>;
export type GetBotQueryResult = Apollo.QueryResult<GetBotQuery, GetBotQueryVariables>;
export const GetBotRunnerStatusDocument = gql`
    query GetBotRunnerStatus($id: ID!) {
  getBotRunnerStatus(id: $id) {
    botID
    status
    containerID
    healthy
    lastSeenAt
    cpuUsage
    memoryUsage
    ipAddress
    hostPort
    errorMessage
    createdAt
    startedAt
    stoppedAt
  }
}
    `;

/**
 * __useGetBotRunnerStatusQuery__
 *
 * To run a query within a React component, call `useGetBotRunnerStatusQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetBotRunnerStatusQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetBotRunnerStatusQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetBotRunnerStatusQuery(baseOptions: Apollo.QueryHookOptions<GetBotRunnerStatusQuery, GetBotRunnerStatusQueryVariables> & ({ variables: GetBotRunnerStatusQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetBotRunnerStatusQuery, GetBotRunnerStatusQueryVariables>(GetBotRunnerStatusDocument, options);
      }
export function useGetBotRunnerStatusLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetBotRunnerStatusQuery, GetBotRunnerStatusQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetBotRunnerStatusQuery, GetBotRunnerStatusQueryVariables>(GetBotRunnerStatusDocument, options);
        }
export function useGetBotRunnerStatusSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetBotRunnerStatusQuery, GetBotRunnerStatusQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetBotRunnerStatusQuery, GetBotRunnerStatusQueryVariables>(GetBotRunnerStatusDocument, options);
        }
export type GetBotRunnerStatusQueryHookResult = ReturnType<typeof useGetBotRunnerStatusQuery>;
export type GetBotRunnerStatusLazyQueryHookResult = ReturnType<typeof useGetBotRunnerStatusLazyQuery>;
export type GetBotRunnerStatusSuspenseQueryHookResult = ReturnType<typeof useGetBotRunnerStatusSuspenseQuery>;
export type GetBotRunnerStatusQueryResult = Apollo.QueryResult<GetBotRunnerStatusQuery, GetBotRunnerStatusQueryVariables>;
export const CreateBotDocument = gql`
    mutation CreateBot($input: CreateBotInput!) {
  createBot(input: $input) {
    id
    name
    status
    mode
    freqtradeVersion
    config
  }
}
    `;
export type CreateBotMutationFn = Apollo.MutationFunction<CreateBotMutation, CreateBotMutationVariables>;

/**
 * __useCreateBotMutation__
 *
 * To run a mutation, you first call `useCreateBotMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateBotMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createBotMutation, { data, loading, error }] = useCreateBotMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateBotMutation(baseOptions?: Apollo.MutationHookOptions<CreateBotMutation, CreateBotMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateBotMutation, CreateBotMutationVariables>(CreateBotDocument, options);
      }
export type CreateBotMutationHookResult = ReturnType<typeof useCreateBotMutation>;
export type CreateBotMutationResult = Apollo.MutationResult<CreateBotMutation>;
export type CreateBotMutationOptions = Apollo.BaseMutationOptions<CreateBotMutation, CreateBotMutationVariables>;
export const UpdateBotDocument = gql`
    mutation UpdateBot($id: ID!, $input: UpdateBotInput!) {
  updateBot(id: $id, input: $input) {
    id
    name
    status
    mode
    config
  }
}
    `;
export type UpdateBotMutationFn = Apollo.MutationFunction<UpdateBotMutation, UpdateBotMutationVariables>;

/**
 * __useUpdateBotMutation__
 *
 * To run a mutation, you first call `useUpdateBotMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateBotMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateBotMutation, { data, loading, error }] = useUpdateBotMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateBotMutation(baseOptions?: Apollo.MutationHookOptions<UpdateBotMutation, UpdateBotMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateBotMutation, UpdateBotMutationVariables>(UpdateBotDocument, options);
      }
export type UpdateBotMutationHookResult = ReturnType<typeof useUpdateBotMutation>;
export type UpdateBotMutationResult = Apollo.MutationResult<UpdateBotMutation>;
export type UpdateBotMutationOptions = Apollo.BaseMutationOptions<UpdateBotMutation, UpdateBotMutationVariables>;
export const DeleteBotDocument = gql`
    mutation DeleteBot($id: ID!) {
  deleteBot(id: $id)
}
    `;
export type DeleteBotMutationFn = Apollo.MutationFunction<DeleteBotMutation, DeleteBotMutationVariables>;

/**
 * __useDeleteBotMutation__
 *
 * To run a mutation, you first call `useDeleteBotMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteBotMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteBotMutation, { data, loading, error }] = useDeleteBotMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteBotMutation(baseOptions?: Apollo.MutationHookOptions<DeleteBotMutation, DeleteBotMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteBotMutation, DeleteBotMutationVariables>(DeleteBotDocument, options);
      }
export type DeleteBotMutationHookResult = ReturnType<typeof useDeleteBotMutation>;
export type DeleteBotMutationResult = Apollo.MutationResult<DeleteBotMutation>;
export type DeleteBotMutationOptions = Apollo.BaseMutationOptions<DeleteBotMutation, DeleteBotMutationVariables>;
export const StartBotDocument = gql`
    mutation StartBot($id: ID!) {
  startBot(id: $id) {
    id
    name
    status
  }
}
    `;
export type StartBotMutationFn = Apollo.MutationFunction<StartBotMutation, StartBotMutationVariables>;

/**
 * __useStartBotMutation__
 *
 * To run a mutation, you first call `useStartBotMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useStartBotMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [startBotMutation, { data, loading, error }] = useStartBotMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useStartBotMutation(baseOptions?: Apollo.MutationHookOptions<StartBotMutation, StartBotMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<StartBotMutation, StartBotMutationVariables>(StartBotDocument, options);
      }
export type StartBotMutationHookResult = ReturnType<typeof useStartBotMutation>;
export type StartBotMutationResult = Apollo.MutationResult<StartBotMutation>;
export type StartBotMutationOptions = Apollo.BaseMutationOptions<StartBotMutation, StartBotMutationVariables>;
export const StopBotDocument = gql`
    mutation StopBot($id: ID!) {
  stopBot(id: $id) {
    id
    name
    status
  }
}
    `;
export type StopBotMutationFn = Apollo.MutationFunction<StopBotMutation, StopBotMutationVariables>;

/**
 * __useStopBotMutation__
 *
 * To run a mutation, you first call `useStopBotMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useStopBotMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [stopBotMutation, { data, loading, error }] = useStopBotMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useStopBotMutation(baseOptions?: Apollo.MutationHookOptions<StopBotMutation, StopBotMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<StopBotMutation, StopBotMutationVariables>(StopBotDocument, options);
      }
export type StopBotMutationHookResult = ReturnType<typeof useStopBotMutation>;
export type StopBotMutationResult = Apollo.MutationResult<StopBotMutation>;
export type StopBotMutationOptions = Apollo.BaseMutationOptions<StopBotMutation, StopBotMutationVariables>;
export const RestartBotDocument = gql`
    mutation RestartBot($id: ID!) {
  restartBot(id: $id) {
    id
    name
    status
  }
}
    `;
export type RestartBotMutationFn = Apollo.MutationFunction<RestartBotMutation, RestartBotMutationVariables>;

/**
 * __useRestartBotMutation__
 *
 * To run a mutation, you first call `useRestartBotMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRestartBotMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [restartBotMutation, { data, loading, error }] = useRestartBotMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useRestartBotMutation(baseOptions?: Apollo.MutationHookOptions<RestartBotMutation, RestartBotMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RestartBotMutation, RestartBotMutationVariables>(RestartBotDocument, options);
      }
export type RestartBotMutationHookResult = ReturnType<typeof useRestartBotMutation>;
export type RestartBotMutationResult = Apollo.MutationResult<RestartBotMutation>;
export type RestartBotMutationOptions = Apollo.BaseMutationOptions<RestartBotMutation, RestartBotMutationVariables>;
export const SetBotVisibilityDocument = gql`
    mutation SetBotVisibility($id: ID!, $public: Boolean!) {
  setBotVisibility(id: $id, public: $public) {
    id
    name
    public
  }
}
    `;
export type SetBotVisibilityMutationFn = Apollo.MutationFunction<SetBotVisibilityMutation, SetBotVisibilityMutationVariables>;

/**
 * __useSetBotVisibilityMutation__
 *
 * To run a mutation, you first call `useSetBotVisibilityMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useSetBotVisibilityMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [setBotVisibilityMutation, { data, loading, error }] = useSetBotVisibilityMutation({
 *   variables: {
 *      id: // value for 'id'
 *      public: // value for 'public'
 *   },
 * });
 */
export function useSetBotVisibilityMutation(baseOptions?: Apollo.MutationHookOptions<SetBotVisibilityMutation, SetBotVisibilityMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<SetBotVisibilityMutation, SetBotVisibilityMutationVariables>(SetBotVisibilityDocument, options);
      }
export type SetBotVisibilityMutationHookResult = ReturnType<typeof useSetBotVisibilityMutation>;
export type SetBotVisibilityMutationResult = Apollo.MutationResult<SetBotVisibilityMutation>;
export type SetBotVisibilityMutationOptions = Apollo.BaseMutationOptions<SetBotVisibilityMutation, SetBotVisibilityMutationVariables>;
export const GetFreqtradeTokenDocument = gql`
    mutation GetFreqtradeToken($botId: ID!) {
  getFreqtradeToken(botId: $botId) {
    apiUrl
    username
    accessToken
    refreshToken
  }
}
    `;
export type GetFreqtradeTokenMutationFn = Apollo.MutationFunction<GetFreqtradeTokenMutation, GetFreqtradeTokenMutationVariables>;

/**
 * __useGetFreqtradeTokenMutation__
 *
 * To run a mutation, you first call `useGetFreqtradeTokenMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useGetFreqtradeTokenMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [getFreqtradeTokenMutation, { data, loading, error }] = useGetFreqtradeTokenMutation({
 *   variables: {
 *      botId: // value for 'botId'
 *   },
 * });
 */
export function useGetFreqtradeTokenMutation(baseOptions?: Apollo.MutationHookOptions<GetFreqtradeTokenMutation, GetFreqtradeTokenMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<GetFreqtradeTokenMutation, GetFreqtradeTokenMutationVariables>(GetFreqtradeTokenDocument, options);
      }
export type GetFreqtradeTokenMutationHookResult = ReturnType<typeof useGetFreqtradeTokenMutation>;
export type GetFreqtradeTokenMutationResult = Apollo.MutationResult<GetFreqtradeTokenMutation>;
export type GetFreqtradeTokenMutationOptions = Apollo.BaseMutationOptions<GetFreqtradeTokenMutation, GetFreqtradeTokenMutationVariables>;