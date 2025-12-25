import * as Types from '../../generated/types';

import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
const defaultOptions = {} as const;
export type GetTradesQueryVariables = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['Cursor']['input']>;
  where?: Types.InputMaybe<Types.TradeWhereInput>;
  orderBy?: Types.InputMaybe<Types.TradeOrder>;
}>;


export type GetTradesQuery = { __typename?: 'Query', trades: { __typename?: 'TradeConnection', totalCount: number, edges?: Array<{ __typename?: 'TradeEdge', node?: { __typename?: 'Trade', id: string, freqtradeTradeID: number, pair: string, isOpen: boolean, openDate: string, closeDate?: string | null, openRate: number, closeRate?: number | null, amount: number, stakeAmount: number, profitAbs: number, profitRatio: number, sellReason?: string | null, strategyName?: string | null, timeframe?: string | null, createdAt: string, updatedAt: string, bot: { __typename?: 'Bot', id: string, name: string } } | null } | null> | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type GetTradeQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type GetTradeQuery = { __typename?: 'Query', trades: { __typename?: 'TradeConnection', edges?: Array<{ __typename?: 'TradeEdge', node?: { __typename?: 'Trade', id: string, freqtradeTradeID: number, pair: string, isOpen: boolean, openDate: string, closeDate?: string | null, openRate: number, closeRate?: number | null, amount: number, stakeAmount: number, profitAbs: number, profitRatio: number, sellReason?: string | null, strategyName?: string | null, timeframe?: string | null, createdAt: string, updatedAt: string, bot: { __typename?: 'Bot', id: string, name: string, strategy: { __typename?: 'Strategy', id: string, name: string }, exchange: { __typename?: 'Exchange', id: string, name: string } } } | null } | null> | null } };


export const GetTradesDocument = gql`
    query GetTrades($first: Int, $after: Cursor, $where: TradeWhereInput, $orderBy: TradeOrder) {
  trades(first: $first, after: $after, where: $where, orderBy: $orderBy) {
    edges {
      node {
        id
        freqtradeTradeID
        pair
        isOpen
        openDate
        closeDate
        openRate
        closeRate
        amount
        stakeAmount
        profitAbs
        profitRatio
        sellReason
        strategyName
        timeframe
        createdAt
        updatedAt
        bot {
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
 * __useGetTradesQuery__
 *
 * To run a query within a React component, call `useGetTradesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetTradesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetTradesQuery({
 *   variables: {
 *      first: // value for 'first'
 *      after: // value for 'after'
 *      where: // value for 'where'
 *      orderBy: // value for 'orderBy'
 *   },
 * });
 */
export function useGetTradesQuery(baseOptions?: Apollo.QueryHookOptions<GetTradesQuery, GetTradesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetTradesQuery, GetTradesQueryVariables>(GetTradesDocument, options);
      }
export function useGetTradesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetTradesQuery, GetTradesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetTradesQuery, GetTradesQueryVariables>(GetTradesDocument, options);
        }
export function useGetTradesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetTradesQuery, GetTradesQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetTradesQuery, GetTradesQueryVariables>(GetTradesDocument, options);
        }
export type GetTradesQueryHookResult = ReturnType<typeof useGetTradesQuery>;
export type GetTradesLazyQueryHookResult = ReturnType<typeof useGetTradesLazyQuery>;
export type GetTradesSuspenseQueryHookResult = ReturnType<typeof useGetTradesSuspenseQuery>;
export type GetTradesQueryResult = Apollo.QueryResult<GetTradesQuery, GetTradesQueryVariables>;
export const GetTradeDocument = gql`
    query GetTrade($id: ID!) {
  trades(where: {id: $id}, first: 1) {
    edges {
      node {
        id
        freqtradeTradeID
        pair
        isOpen
        openDate
        closeDate
        openRate
        closeRate
        amount
        stakeAmount
        profitAbs
        profitRatio
        sellReason
        strategyName
        timeframe
        createdAt
        updatedAt
        bot {
          id
          name
          strategy {
            id
            name
          }
          exchange {
            id
            name
          }
        }
      }
    }
  }
}
    `;

/**
 * __useGetTradeQuery__
 *
 * To run a query within a React component, call `useGetTradeQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetTradeQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetTradeQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetTradeQuery(baseOptions: Apollo.QueryHookOptions<GetTradeQuery, GetTradeQueryVariables> & ({ variables: GetTradeQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetTradeQuery, GetTradeQueryVariables>(GetTradeDocument, options);
      }
export function useGetTradeLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetTradeQuery, GetTradeQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetTradeQuery, GetTradeQueryVariables>(GetTradeDocument, options);
        }
export function useGetTradeSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetTradeQuery, GetTradeQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetTradeQuery, GetTradeQueryVariables>(GetTradeDocument, options);
        }
export type GetTradeQueryHookResult = ReturnType<typeof useGetTradeQuery>;
export type GetTradeLazyQueryHookResult = ReturnType<typeof useGetTradeLazyQuery>;
export type GetTradeSuspenseQueryHookResult = ReturnType<typeof useGetTradeSuspenseQuery>;
export type GetTradeQueryResult = Apollo.QueryResult<GetTradeQuery, GetTradeQueryVariables>;