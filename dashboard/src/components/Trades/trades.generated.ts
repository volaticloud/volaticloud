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

export type TradeUpdatedSubscriptionVariables = Types.Exact<{
  botId: Types.Scalars['ID']['input'];
}>;


export type TradeUpdatedSubscription = { __typename?: 'Subscription', tradeUpdated: { __typename?: 'Trade', id: string, freqtradeTradeID: number, pair: string, isOpen: boolean, openDate: string, closeDate?: string | null, openRate: number, closeRate?: number | null, amount: number, stakeAmount: number, profitAbs: number, profitRatio: number, sellReason?: string | null, createdAt: string, updatedAt: string } };

export type TradeChangedSubscriptionVariables = Types.Exact<{
  ownerId: Types.Scalars['String']['input'];
}>;


export type TradeChangedSubscription = { __typename?: 'Subscription', tradeChanged: { __typename?: 'Trade', id: string, freqtradeTradeID: number, pair: string, isOpen: boolean, openDate: string, closeDate?: string | null, openRate: number, closeRate?: number | null, profitAbs: number, profitRatio: number, sellReason?: string | null, bot: { __typename?: 'Bot', id: string, name: string } } };


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
// @ts-ignore
export function useGetTradesSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetTradesQuery, GetTradesQueryVariables>): Apollo.UseSuspenseQueryResult<GetTradesQuery, GetTradesQueryVariables>;
export function useGetTradesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetTradesQuery, GetTradesQueryVariables>): Apollo.UseSuspenseQueryResult<GetTradesQuery | undefined, GetTradesQueryVariables>;
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
// @ts-ignore
export function useGetTradeSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetTradeQuery, GetTradeQueryVariables>): Apollo.UseSuspenseQueryResult<GetTradeQuery, GetTradeQueryVariables>;
export function useGetTradeSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetTradeQuery, GetTradeQueryVariables>): Apollo.UseSuspenseQueryResult<GetTradeQuery | undefined, GetTradeQueryVariables>;
export function useGetTradeSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetTradeQuery, GetTradeQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetTradeQuery, GetTradeQueryVariables>(GetTradeDocument, options);
        }
export type GetTradeQueryHookResult = ReturnType<typeof useGetTradeQuery>;
export type GetTradeLazyQueryHookResult = ReturnType<typeof useGetTradeLazyQuery>;
export type GetTradeSuspenseQueryHookResult = ReturnType<typeof useGetTradeSuspenseQuery>;
export type GetTradeQueryResult = Apollo.QueryResult<GetTradeQuery, GetTradeQueryVariables>;
export const TradeUpdatedDocument = gql`
    subscription TradeUpdated($botId: ID!) {
  tradeUpdated(botId: $botId) {
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
    createdAt
    updatedAt
  }
}
    `;

/**
 * __useTradeUpdatedSubscription__
 *
 * To run a query within a React component, call `useTradeUpdatedSubscription` and pass it any options that fit your needs.
 * When your component renders, `useTradeUpdatedSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTradeUpdatedSubscription({
 *   variables: {
 *      botId: // value for 'botId'
 *   },
 * });
 */
export function useTradeUpdatedSubscription(baseOptions: Apollo.SubscriptionHookOptions<TradeUpdatedSubscription, TradeUpdatedSubscriptionVariables> & ({ variables: TradeUpdatedSubscriptionVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useSubscription<TradeUpdatedSubscription, TradeUpdatedSubscriptionVariables>(TradeUpdatedDocument, options);
      }
export type TradeUpdatedSubscriptionHookResult = ReturnType<typeof useTradeUpdatedSubscription>;
export type TradeUpdatedSubscriptionResult = Apollo.SubscriptionResult<TradeUpdatedSubscription>;
export const TradeChangedDocument = gql`
    subscription TradeChanged($ownerId: String!) {
  tradeChanged(ownerId: $ownerId) {
    id
    freqtradeTradeID
    pair
    isOpen
    openDate
    closeDate
    openRate
    closeRate
    profitAbs
    profitRatio
    sellReason
    bot {
      id
      name
    }
  }
}
    `;

/**
 * __useTradeChangedSubscription__
 *
 * To run a query within a React component, call `useTradeChangedSubscription` and pass it any options that fit your needs.
 * When your component renders, `useTradeChangedSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTradeChangedSubscription({
 *   variables: {
 *      ownerId: // value for 'ownerId'
 *   },
 * });
 */
export function useTradeChangedSubscription(baseOptions: Apollo.SubscriptionHookOptions<TradeChangedSubscription, TradeChangedSubscriptionVariables> & ({ variables: TradeChangedSubscriptionVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useSubscription<TradeChangedSubscription, TradeChangedSubscriptionVariables>(TradeChangedDocument, options);
      }
export type TradeChangedSubscriptionHookResult = ReturnType<typeof useTradeChangedSubscription>;
export type TradeChangedSubscriptionResult = Apollo.SubscriptionResult<TradeChangedSubscription>;