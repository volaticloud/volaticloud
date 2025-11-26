import * as Types from '../../generated/types';

import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
const defaultOptions = {} as const;
export type GetDashboardDataQueryVariables = Types.Exact<{ [key: string]: never; }>;


export type GetDashboardDataQuery = { __typename?: 'Query', bots: { __typename?: 'BotConnection', totalCount: number, edges?: Array<{ __typename?: 'BotEdge', node?: { __typename?: 'Bot', id: string, name: string, status: Types.BotBotStatus, mode: Types.BotBotMode, freqtradeVersion: string, lastSeenAt?: string | null, exchange: { __typename?: 'Exchange', id: string, name: string }, strategy: { __typename?: 'Strategy', id: string, name: string } } | null } | null> | null }, trades: { __typename?: 'TradeConnection', totalCount: number, edges?: Array<{ __typename?: 'TradeEdge', node?: { __typename?: 'Trade', id: string, pair: string, isOpen: boolean, openDate: string, closeDate?: string | null, profitAbs: number, profitRatio: number, bot: { __typename?: 'Bot', id: string, name: string } } | null } | null> | null }, exchanges: { __typename?: 'ExchangeConnection', totalCount: number, edges?: Array<{ __typename?: 'ExchangeEdge', node?: { __typename?: 'Exchange', id: string, name: string } | null } | null> | null }, strategies: { __typename?: 'StrategyConnection', totalCount: number, edges?: Array<{ __typename?: 'StrategyEdge', node?: { __typename?: 'Strategy', id: string, name: string } | null } | null> | null } };


export const GetDashboardDataDocument = gql`
    query GetDashboardData {
  bots(first: 10) {
    edges {
      node {
        id
        name
        status
        mode
        freqtradeVersion
        lastSeenAt
        exchange {
          id
          name
        }
        strategy {
          id
          name
        }
      }
    }
    totalCount
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
        bot {
          id
          name
        }
      }
    }
    totalCount
  }
  exchanges(first: 50) {
    edges {
      node {
        id
        name
      }
    }
    totalCount
  }
  strategies(first: 10) {
    edges {
      node {
        id
        name
      }
    }
    totalCount
  }
}
    `;

/**
 * __useGetDashboardDataQuery__
 *
 * To run a query within a React component, call `useGetDashboardDataQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetDashboardDataQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetDashboardDataQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetDashboardDataQuery(baseOptions?: Apollo.QueryHookOptions<GetDashboardDataQuery, GetDashboardDataQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetDashboardDataQuery, GetDashboardDataQueryVariables>(GetDashboardDataDocument, options);
      }
export function useGetDashboardDataLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetDashboardDataQuery, GetDashboardDataQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetDashboardDataQuery, GetDashboardDataQueryVariables>(GetDashboardDataDocument, options);
        }
export function useGetDashboardDataSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetDashboardDataQuery, GetDashboardDataQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetDashboardDataQuery, GetDashboardDataQueryVariables>(GetDashboardDataDocument, options);
        }
export type GetDashboardDataQueryHookResult = ReturnType<typeof useGetDashboardDataQuery>;
export type GetDashboardDataLazyQueryHookResult = ReturnType<typeof useGetDashboardDataLazyQuery>;
export type GetDashboardDataSuspenseQueryHookResult = ReturnType<typeof useGetDashboardDataSuspenseQuery>;
export type GetDashboardDataQueryResult = Apollo.QueryResult<GetDashboardDataQuery, GetDashboardDataQueryVariables>;