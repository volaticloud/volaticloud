import * as Types from '../../generated/types';

import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
const defaultOptions = {} as const;
export type GetStrategyDetailQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type GetStrategyDetailQuery = { __typename?: 'Query', strategies: { __typename?: 'StrategyConnection', edges?: Array<{ __typename?: 'StrategyEdge', node?: { __typename?: 'Strategy', id: string, name: string, description?: string | null, code: string, version: string, versionNumber: number, isLatest: boolean, createdAt: string, updatedAt: string, bots: { __typename?: 'BotConnection', totalCount: number }, backtest?: { __typename?: 'Backtest', id: string, status: Types.BacktestTaskStatus, createdAt: string, updatedAt: string, result?: Record<string, any> | null, runner: { __typename?: 'BotRunner', id: string, name: string, type: Types.BotRunnerRunnerType }, summary?: { __typename?: 'BacktestSummary', strategyName: string, totalTrades: number, wins: number, losses: number, profitTotalAbs: number, profitTotal: number, winRate?: number | null, expectancy?: number | null, profitFactor?: number | null, maxDrawdown?: number | null } | null } | null } | null } | null> | null } };

export type GetStrategyVersionsQueryVariables = Types.Exact<{
  name: Types.Scalars['String']['input'];
}>;


export type GetStrategyVersionsQuery = { __typename?: 'Query', strategyVersions: Array<{ __typename?: 'Strategy', id: string, name: string, versionNumber: number, version: string, isLatest: boolean, createdAt: string, bots: { __typename?: 'BotConnection', totalCount: number }, backtest?: { __typename?: 'Backtest', id: string, status: Types.BacktestTaskStatus } | null }> };


export const GetStrategyDetailDocument = gql`
    query GetStrategyDetail($id: ID!) {
  strategies(where: {id: $id}, first: 1) {
    edges {
      node {
        id
        name
        description
        code
        version
        versionNumber
        isLatest
        createdAt
        updatedAt
        bots {
          totalCount
        }
        backtest {
          id
          status
          createdAt
          updatedAt
          result
          runner {
            id
            name
            type
          }
          summary {
            strategyName
            totalTrades
            wins
            losses
            profitTotalAbs
            profitTotal
            winRate
            expectancy
            profitFactor
            maxDrawdown
          }
        }
      }
    }
  }
}
    `;

/**
 * __useGetStrategyDetailQuery__
 *
 * To run a query within a React component, call `useGetStrategyDetailQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetStrategyDetailQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetStrategyDetailQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetStrategyDetailQuery(baseOptions: Apollo.QueryHookOptions<GetStrategyDetailQuery, GetStrategyDetailQueryVariables> & ({ variables: GetStrategyDetailQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetStrategyDetailQuery, GetStrategyDetailQueryVariables>(GetStrategyDetailDocument, options);
      }
export function useGetStrategyDetailLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetStrategyDetailQuery, GetStrategyDetailQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetStrategyDetailQuery, GetStrategyDetailQueryVariables>(GetStrategyDetailDocument, options);
        }
export function useGetStrategyDetailSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetStrategyDetailQuery, GetStrategyDetailQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetStrategyDetailQuery, GetStrategyDetailQueryVariables>(GetStrategyDetailDocument, options);
        }
export type GetStrategyDetailQueryHookResult = ReturnType<typeof useGetStrategyDetailQuery>;
export type GetStrategyDetailLazyQueryHookResult = ReturnType<typeof useGetStrategyDetailLazyQuery>;
export type GetStrategyDetailSuspenseQueryHookResult = ReturnType<typeof useGetStrategyDetailSuspenseQuery>;
export type GetStrategyDetailQueryResult = Apollo.QueryResult<GetStrategyDetailQuery, GetStrategyDetailQueryVariables>;
export const GetStrategyVersionsDocument = gql`
    query GetStrategyVersions($name: String!) {
  strategyVersions(name: $name) {
    id
    name
    versionNumber
    version
    isLatest
    createdAt
    bots {
      totalCount
    }
    backtest {
      id
      status
    }
  }
}
    `;

/**
 * __useGetStrategyVersionsQuery__
 *
 * To run a query within a React component, call `useGetStrategyVersionsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetStrategyVersionsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetStrategyVersionsQuery({
 *   variables: {
 *      name: // value for 'name'
 *   },
 * });
 */
export function useGetStrategyVersionsQuery(baseOptions: Apollo.QueryHookOptions<GetStrategyVersionsQuery, GetStrategyVersionsQueryVariables> & ({ variables: GetStrategyVersionsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetStrategyVersionsQuery, GetStrategyVersionsQueryVariables>(GetStrategyVersionsDocument, options);
      }
export function useGetStrategyVersionsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetStrategyVersionsQuery, GetStrategyVersionsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetStrategyVersionsQuery, GetStrategyVersionsQueryVariables>(GetStrategyVersionsDocument, options);
        }
export function useGetStrategyVersionsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetStrategyVersionsQuery, GetStrategyVersionsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetStrategyVersionsQuery, GetStrategyVersionsQueryVariables>(GetStrategyVersionsDocument, options);
        }
export type GetStrategyVersionsQueryHookResult = ReturnType<typeof useGetStrategyVersionsQuery>;
export type GetStrategyVersionsLazyQueryHookResult = ReturnType<typeof useGetStrategyVersionsLazyQuery>;
export type GetStrategyVersionsSuspenseQueryHookResult = ReturnType<typeof useGetStrategyVersionsSuspenseQuery>;
export type GetStrategyVersionsQueryResult = Apollo.QueryResult<GetStrategyVersionsQuery, GetStrategyVersionsQueryVariables>;