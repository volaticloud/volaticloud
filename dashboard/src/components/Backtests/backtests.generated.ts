import * as Types from '../../generated/types';

import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
const defaultOptions = {} as const;
export type GetBacktestsQueryVariables = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['Cursor']['input']>;
  where?: Types.InputMaybe<Types.BacktestWhereInput>;
}>;


export type GetBacktestsQuery = { __typename?: 'Query', backtests: { __typename?: 'BacktestConnection', totalCount: number, edges?: Array<{ __typename?: 'BacktestEdge', node?: { __typename?: 'Backtest', id: string, status: Types.BacktestTaskStatus, result?: Record<string, any> | null, errorMessage?: string | null, createdAt: string, updatedAt: string, completedAt?: string | null, strategy: { __typename?: 'Strategy', id: string, name: string, config: Record<string, any> }, runner: { __typename?: 'BotRunner', id: string, name: string, type: Types.BotRunnerRunnerType } } | null } | null> | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type GetBacktestQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type GetBacktestQuery = { __typename?: 'Query', backtests: { __typename?: 'BacktestConnection', edges?: Array<{ __typename?: 'BacktestEdge', node?: { __typename?: 'Backtest', id: string, status: Types.BacktestTaskStatus, result?: Record<string, any> | null, logs?: string | null, errorMessage?: string | null, createdAt: string, updatedAt: string, completedAt?: string | null, strategy: { __typename?: 'Strategy', id: string, name: string, description?: string | null }, runner: { __typename?: 'BotRunner', id: string, name: string, type: Types.BotRunnerRunnerType } } | null } | null> | null } };

export type GetBacktestOptionsQueryVariables = Types.Exact<{
  ownerID?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;


export type GetBacktestOptionsQuery = { __typename?: 'Query', botRunners: { __typename?: 'BotRunnerConnection', edges?: Array<{ __typename?: 'BotRunnerEdge', node?: { __typename?: 'BotRunner', id: string, name: string, type: Types.BotRunnerRunnerType } | null } | null> | null } };

export type SearchStrategiesQueryVariables = Types.Exact<{
  search?: Types.InputMaybe<Types.Scalars['String']['input']>;
  ownerID?: Types.InputMaybe<Types.Scalars['String']['input']>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type SearchStrategiesQuery = { __typename?: 'Query', strategies: { __typename?: 'StrategyConnection', edges?: Array<{ __typename?: 'StrategyEdge', node?: { __typename?: 'Strategy', id: string, name: string, versionNumber: number, isLatest: boolean, config: Record<string, any> } | null } | null> | null } };

export type GetStrategyByIdQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type GetStrategyByIdQuery = { __typename?: 'Query', strategies: { __typename?: 'StrategyConnection', edges?: Array<{ __typename?: 'StrategyEdge', node?: { __typename?: 'Strategy', id: string, name: string, versionNumber: number, isLatest: boolean, config: Record<string, any> } | null } | null> | null } };

export type RunBacktestMutationVariables = Types.Exact<{
  input: Types.CreateBacktestInput;
}>;


export type RunBacktestMutation = { __typename?: 'Mutation', runBacktest: { __typename?: 'Backtest', id: string, status: Types.BacktestTaskStatus, createdAt: string, strategy: { __typename?: 'Strategy', id: string, name: string, versionNumber: number } } };

export type StopBacktestMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type StopBacktestMutation = { __typename?: 'Mutation', stopBacktest: { __typename?: 'Backtest', id: string, status: Types.BacktestTaskStatus } };

export type DeleteBacktestMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type DeleteBacktestMutation = { __typename?: 'Mutation', deleteBacktest: boolean };

export type BacktestProgressSubscriptionVariables = Types.Exact<{
  backtestId: Types.Scalars['ID']['input'];
}>;


export type BacktestProgressSubscription = { __typename?: 'Subscription', backtestProgress: { __typename?: 'Backtest', id: string, status: Types.BacktestTaskStatus, result?: Record<string, any> | null, logs?: string | null, errorMessage?: string | null, createdAt: string, updatedAt: string, completedAt?: string | null, strategy: { __typename?: 'Strategy', id: string, name: string } } };


export const GetBacktestsDocument = gql`
    query GetBacktests($first: Int, $after: Cursor, $where: BacktestWhereInput) {
  backtests(first: $first, after: $after, where: $where) {
    edges {
      node {
        id
        status
        result
        errorMessage
        createdAt
        updatedAt
        completedAt
        strategy {
          id
          name
          config
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
 * __useGetBacktestsQuery__
 *
 * To run a query within a React component, call `useGetBacktestsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetBacktestsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetBacktestsQuery({
 *   variables: {
 *      first: // value for 'first'
 *      after: // value for 'after'
 *      where: // value for 'where'
 *   },
 * });
 */
export function useGetBacktestsQuery(baseOptions?: Apollo.QueryHookOptions<GetBacktestsQuery, GetBacktestsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetBacktestsQuery, GetBacktestsQueryVariables>(GetBacktestsDocument, options);
      }
export function useGetBacktestsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetBacktestsQuery, GetBacktestsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetBacktestsQuery, GetBacktestsQueryVariables>(GetBacktestsDocument, options);
        }
// @ts-ignore
export function useGetBacktestsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetBacktestsQuery, GetBacktestsQueryVariables>): Apollo.UseSuspenseQueryResult<GetBacktestsQuery, GetBacktestsQueryVariables>;
export function useGetBacktestsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetBacktestsQuery, GetBacktestsQueryVariables>): Apollo.UseSuspenseQueryResult<GetBacktestsQuery | undefined, GetBacktestsQueryVariables>;
export function useGetBacktestsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetBacktestsQuery, GetBacktestsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetBacktestsQuery, GetBacktestsQueryVariables>(GetBacktestsDocument, options);
        }
export type GetBacktestsQueryHookResult = ReturnType<typeof useGetBacktestsQuery>;
export type GetBacktestsLazyQueryHookResult = ReturnType<typeof useGetBacktestsLazyQuery>;
export type GetBacktestsSuspenseQueryHookResult = ReturnType<typeof useGetBacktestsSuspenseQuery>;
export type GetBacktestsQueryResult = Apollo.QueryResult<GetBacktestsQuery, GetBacktestsQueryVariables>;
export const GetBacktestDocument = gql`
    query GetBacktest($id: ID!) {
  backtests(where: {id: $id}, first: 1) {
    edges {
      node {
        id
        status
        result
        logs
        errorMessage
        createdAt
        updatedAt
        completedAt
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
      }
    }
  }
}
    `;

/**
 * __useGetBacktestQuery__
 *
 * To run a query within a React component, call `useGetBacktestQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetBacktestQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetBacktestQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetBacktestQuery(baseOptions: Apollo.QueryHookOptions<GetBacktestQuery, GetBacktestQueryVariables> & ({ variables: GetBacktestQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetBacktestQuery, GetBacktestQueryVariables>(GetBacktestDocument, options);
      }
export function useGetBacktestLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetBacktestQuery, GetBacktestQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetBacktestQuery, GetBacktestQueryVariables>(GetBacktestDocument, options);
        }
// @ts-ignore
export function useGetBacktestSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetBacktestQuery, GetBacktestQueryVariables>): Apollo.UseSuspenseQueryResult<GetBacktestQuery, GetBacktestQueryVariables>;
export function useGetBacktestSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetBacktestQuery, GetBacktestQueryVariables>): Apollo.UseSuspenseQueryResult<GetBacktestQuery | undefined, GetBacktestQueryVariables>;
export function useGetBacktestSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetBacktestQuery, GetBacktestQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetBacktestQuery, GetBacktestQueryVariables>(GetBacktestDocument, options);
        }
export type GetBacktestQueryHookResult = ReturnType<typeof useGetBacktestQuery>;
export type GetBacktestLazyQueryHookResult = ReturnType<typeof useGetBacktestLazyQuery>;
export type GetBacktestSuspenseQueryHookResult = ReturnType<typeof useGetBacktestSuspenseQuery>;
export type GetBacktestQueryResult = Apollo.QueryResult<GetBacktestQuery, GetBacktestQueryVariables>;
export const GetBacktestOptionsDocument = gql`
    query GetBacktestOptions($ownerID: String) {
  botRunners(first: 50, where: {ownerID: $ownerID}) {
    edges {
      node {
        id
        name
        type
      }
    }
  }
}
    `;

/**
 * __useGetBacktestOptionsQuery__
 *
 * To run a query within a React component, call `useGetBacktestOptionsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetBacktestOptionsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetBacktestOptionsQuery({
 *   variables: {
 *      ownerID: // value for 'ownerID'
 *   },
 * });
 */
export function useGetBacktestOptionsQuery(baseOptions?: Apollo.QueryHookOptions<GetBacktestOptionsQuery, GetBacktestOptionsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetBacktestOptionsQuery, GetBacktestOptionsQueryVariables>(GetBacktestOptionsDocument, options);
      }
export function useGetBacktestOptionsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetBacktestOptionsQuery, GetBacktestOptionsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetBacktestOptionsQuery, GetBacktestOptionsQueryVariables>(GetBacktestOptionsDocument, options);
        }
// @ts-ignore
export function useGetBacktestOptionsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetBacktestOptionsQuery, GetBacktestOptionsQueryVariables>): Apollo.UseSuspenseQueryResult<GetBacktestOptionsQuery, GetBacktestOptionsQueryVariables>;
export function useGetBacktestOptionsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetBacktestOptionsQuery, GetBacktestOptionsQueryVariables>): Apollo.UseSuspenseQueryResult<GetBacktestOptionsQuery | undefined, GetBacktestOptionsQueryVariables>;
export function useGetBacktestOptionsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetBacktestOptionsQuery, GetBacktestOptionsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetBacktestOptionsQuery, GetBacktestOptionsQueryVariables>(GetBacktestOptionsDocument, options);
        }
export type GetBacktestOptionsQueryHookResult = ReturnType<typeof useGetBacktestOptionsQuery>;
export type GetBacktestOptionsLazyQueryHookResult = ReturnType<typeof useGetBacktestOptionsLazyQuery>;
export type GetBacktestOptionsSuspenseQueryHookResult = ReturnType<typeof useGetBacktestOptionsSuspenseQuery>;
export type GetBacktestOptionsQueryResult = Apollo.QueryResult<GetBacktestOptionsQuery, GetBacktestOptionsQueryVariables>;
export const SearchStrategiesDocument = gql`
    query SearchStrategies($search: String, $ownerID: String, $first: Int) {
  strategies(first: $first, where: {ownerID: $ownerID, nameContainsFold: $search}) {
    edges {
      node {
        id
        name
        versionNumber
        isLatest
        config
      }
    }
  }
}
    `;

/**
 * __useSearchStrategiesQuery__
 *
 * To run a query within a React component, call `useSearchStrategiesQuery` and pass it any options that fit your needs.
 * When your component renders, `useSearchStrategiesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSearchStrategiesQuery({
 *   variables: {
 *      search: // value for 'search'
 *      ownerID: // value for 'ownerID'
 *      first: // value for 'first'
 *   },
 * });
 */
export function useSearchStrategiesQuery(baseOptions?: Apollo.QueryHookOptions<SearchStrategiesQuery, SearchStrategiesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SearchStrategiesQuery, SearchStrategiesQueryVariables>(SearchStrategiesDocument, options);
      }
export function useSearchStrategiesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SearchStrategiesQuery, SearchStrategiesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SearchStrategiesQuery, SearchStrategiesQueryVariables>(SearchStrategiesDocument, options);
        }
// @ts-ignore
export function useSearchStrategiesSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<SearchStrategiesQuery, SearchStrategiesQueryVariables>): Apollo.UseSuspenseQueryResult<SearchStrategiesQuery, SearchStrategiesQueryVariables>;
export function useSearchStrategiesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchStrategiesQuery, SearchStrategiesQueryVariables>): Apollo.UseSuspenseQueryResult<SearchStrategiesQuery | undefined, SearchStrategiesQueryVariables>;
export function useSearchStrategiesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SearchStrategiesQuery, SearchStrategiesQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<SearchStrategiesQuery, SearchStrategiesQueryVariables>(SearchStrategiesDocument, options);
        }
export type SearchStrategiesQueryHookResult = ReturnType<typeof useSearchStrategiesQuery>;
export type SearchStrategiesLazyQueryHookResult = ReturnType<typeof useSearchStrategiesLazyQuery>;
export type SearchStrategiesSuspenseQueryHookResult = ReturnType<typeof useSearchStrategiesSuspenseQuery>;
export type SearchStrategiesQueryResult = Apollo.QueryResult<SearchStrategiesQuery, SearchStrategiesQueryVariables>;
export const GetStrategyByIdDocument = gql`
    query GetStrategyById($id: ID!) {
  strategies(first: 1, where: {id: $id}) {
    edges {
      node {
        id
        name
        versionNumber
        isLatest
        config
      }
    }
  }
}
    `;

/**
 * __useGetStrategyByIdQuery__
 *
 * To run a query within a React component, call `useGetStrategyByIdQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetStrategyByIdQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetStrategyByIdQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetStrategyByIdQuery(baseOptions: Apollo.QueryHookOptions<GetStrategyByIdQuery, GetStrategyByIdQueryVariables> & ({ variables: GetStrategyByIdQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetStrategyByIdQuery, GetStrategyByIdQueryVariables>(GetStrategyByIdDocument, options);
      }
export function useGetStrategyByIdLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetStrategyByIdQuery, GetStrategyByIdQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetStrategyByIdQuery, GetStrategyByIdQueryVariables>(GetStrategyByIdDocument, options);
        }
// @ts-ignore
export function useGetStrategyByIdSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetStrategyByIdQuery, GetStrategyByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetStrategyByIdQuery, GetStrategyByIdQueryVariables>;
export function useGetStrategyByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetStrategyByIdQuery, GetStrategyByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetStrategyByIdQuery | undefined, GetStrategyByIdQueryVariables>;
export function useGetStrategyByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetStrategyByIdQuery, GetStrategyByIdQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetStrategyByIdQuery, GetStrategyByIdQueryVariables>(GetStrategyByIdDocument, options);
        }
export type GetStrategyByIdQueryHookResult = ReturnType<typeof useGetStrategyByIdQuery>;
export type GetStrategyByIdLazyQueryHookResult = ReturnType<typeof useGetStrategyByIdLazyQuery>;
export type GetStrategyByIdSuspenseQueryHookResult = ReturnType<typeof useGetStrategyByIdSuspenseQuery>;
export type GetStrategyByIdQueryResult = Apollo.QueryResult<GetStrategyByIdQuery, GetStrategyByIdQueryVariables>;
export const RunBacktestDocument = gql`
    mutation RunBacktest($input: CreateBacktestInput!) {
  runBacktest(input: $input) {
    id
    status
    createdAt
    strategy {
      id
      name
      versionNumber
    }
  }
}
    `;
export type RunBacktestMutationFn = Apollo.MutationFunction<RunBacktestMutation, RunBacktestMutationVariables>;

/**
 * __useRunBacktestMutation__
 *
 * To run a mutation, you first call `useRunBacktestMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRunBacktestMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [runBacktestMutation, { data, loading, error }] = useRunBacktestMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useRunBacktestMutation(baseOptions?: Apollo.MutationHookOptions<RunBacktestMutation, RunBacktestMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RunBacktestMutation, RunBacktestMutationVariables>(RunBacktestDocument, options);
      }
export type RunBacktestMutationHookResult = ReturnType<typeof useRunBacktestMutation>;
export type RunBacktestMutationResult = Apollo.MutationResult<RunBacktestMutation>;
export type RunBacktestMutationOptions = Apollo.BaseMutationOptions<RunBacktestMutation, RunBacktestMutationVariables>;
export const StopBacktestDocument = gql`
    mutation StopBacktest($id: ID!) {
  stopBacktest(id: $id) {
    id
    status
  }
}
    `;
export type StopBacktestMutationFn = Apollo.MutationFunction<StopBacktestMutation, StopBacktestMutationVariables>;

/**
 * __useStopBacktestMutation__
 *
 * To run a mutation, you first call `useStopBacktestMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useStopBacktestMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [stopBacktestMutation, { data, loading, error }] = useStopBacktestMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useStopBacktestMutation(baseOptions?: Apollo.MutationHookOptions<StopBacktestMutation, StopBacktestMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<StopBacktestMutation, StopBacktestMutationVariables>(StopBacktestDocument, options);
      }
export type StopBacktestMutationHookResult = ReturnType<typeof useStopBacktestMutation>;
export type StopBacktestMutationResult = Apollo.MutationResult<StopBacktestMutation>;
export type StopBacktestMutationOptions = Apollo.BaseMutationOptions<StopBacktestMutation, StopBacktestMutationVariables>;
export const DeleteBacktestDocument = gql`
    mutation DeleteBacktest($id: ID!) {
  deleteBacktest(id: $id)
}
    `;
export type DeleteBacktestMutationFn = Apollo.MutationFunction<DeleteBacktestMutation, DeleteBacktestMutationVariables>;

/**
 * __useDeleteBacktestMutation__
 *
 * To run a mutation, you first call `useDeleteBacktestMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteBacktestMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteBacktestMutation, { data, loading, error }] = useDeleteBacktestMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteBacktestMutation(baseOptions?: Apollo.MutationHookOptions<DeleteBacktestMutation, DeleteBacktestMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteBacktestMutation, DeleteBacktestMutationVariables>(DeleteBacktestDocument, options);
      }
export type DeleteBacktestMutationHookResult = ReturnType<typeof useDeleteBacktestMutation>;
export type DeleteBacktestMutationResult = Apollo.MutationResult<DeleteBacktestMutation>;
export type DeleteBacktestMutationOptions = Apollo.BaseMutationOptions<DeleteBacktestMutation, DeleteBacktestMutationVariables>;
export const BacktestProgressDocument = gql`
    subscription BacktestProgress($backtestId: ID!) {
  backtestProgress(backtestId: $backtestId) {
    id
    status
    result
    logs
    errorMessage
    createdAt
    updatedAt
    completedAt
    strategy {
      id
      name
    }
  }
}
    `;

/**
 * __useBacktestProgressSubscription__
 *
 * To run a query within a React component, call `useBacktestProgressSubscription` and pass it any options that fit your needs.
 * When your component renders, `useBacktestProgressSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useBacktestProgressSubscription({
 *   variables: {
 *      backtestId: // value for 'backtestId'
 *   },
 * });
 */
export function useBacktestProgressSubscription(baseOptions: Apollo.SubscriptionHookOptions<BacktestProgressSubscription, BacktestProgressSubscriptionVariables> & ({ variables: BacktestProgressSubscriptionVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useSubscription<BacktestProgressSubscription, BacktestProgressSubscriptionVariables>(BacktestProgressDocument, options);
      }
export type BacktestProgressSubscriptionHookResult = ReturnType<typeof useBacktestProgressSubscription>;
export type BacktestProgressSubscriptionResult = Apollo.SubscriptionResult<BacktestProgressSubscription>;