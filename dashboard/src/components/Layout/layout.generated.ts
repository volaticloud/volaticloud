import * as Types from '../../generated/types';

import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
const defaultOptions = {} as const;
export type GetBotsCountQueryVariables = Types.Exact<{ [key: string]: never; }>;


export type GetBotsCountQuery = { __typename?: 'Query', bots: { __typename?: 'BotConnection', totalCount: number } };

export type GetExchangesForLayoutQueryVariables = Types.Exact<{ [key: string]: never; }>;


export type GetExchangesForLayoutQuery = { __typename?: 'Query', exchanges: { __typename?: 'ExchangeConnection', totalCount: number, edges?: Array<{ __typename?: 'ExchangeEdge', node?: { __typename?: 'Exchange', id: string, name: string } | null } | null> | null } };


export const GetBotsCountDocument = gql`
    query GetBotsCount {
  bots(first: 1) {
    totalCount
  }
}
    `;

/**
 * __useGetBotsCountQuery__
 *
 * To run a query within a React component, call `useGetBotsCountQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetBotsCountQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetBotsCountQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetBotsCountQuery(baseOptions?: Apollo.QueryHookOptions<GetBotsCountQuery, GetBotsCountQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetBotsCountQuery, GetBotsCountQueryVariables>(GetBotsCountDocument, options);
      }
export function useGetBotsCountLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetBotsCountQuery, GetBotsCountQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetBotsCountQuery, GetBotsCountQueryVariables>(GetBotsCountDocument, options);
        }
export function useGetBotsCountSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetBotsCountQuery, GetBotsCountQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetBotsCountQuery, GetBotsCountQueryVariables>(GetBotsCountDocument, options);
        }
export type GetBotsCountQueryHookResult = ReturnType<typeof useGetBotsCountQuery>;
export type GetBotsCountLazyQueryHookResult = ReturnType<typeof useGetBotsCountLazyQuery>;
export type GetBotsCountSuspenseQueryHookResult = ReturnType<typeof useGetBotsCountSuspenseQuery>;
export type GetBotsCountQueryResult = Apollo.QueryResult<GetBotsCountQuery, GetBotsCountQueryVariables>;
export const GetExchangesForLayoutDocument = gql`
    query GetExchangesForLayout {
  exchanges(first: 50) {
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
 * __useGetExchangesForLayoutQuery__
 *
 * To run a query within a React component, call `useGetExchangesForLayoutQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetExchangesForLayoutQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetExchangesForLayoutQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetExchangesForLayoutQuery(baseOptions?: Apollo.QueryHookOptions<GetExchangesForLayoutQuery, GetExchangesForLayoutQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetExchangesForLayoutQuery, GetExchangesForLayoutQueryVariables>(GetExchangesForLayoutDocument, options);
      }
export function useGetExchangesForLayoutLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetExchangesForLayoutQuery, GetExchangesForLayoutQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetExchangesForLayoutQuery, GetExchangesForLayoutQueryVariables>(GetExchangesForLayoutDocument, options);
        }
export function useGetExchangesForLayoutSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetExchangesForLayoutQuery, GetExchangesForLayoutQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetExchangesForLayoutQuery, GetExchangesForLayoutQueryVariables>(GetExchangesForLayoutDocument, options);
        }
export type GetExchangesForLayoutQueryHookResult = ReturnType<typeof useGetExchangesForLayoutQuery>;
export type GetExchangesForLayoutLazyQueryHookResult = ReturnType<typeof useGetExchangesForLayoutLazyQuery>;
export type GetExchangesForLayoutSuspenseQueryHookResult = ReturnType<typeof useGetExchangesForLayoutSuspenseQuery>;
export type GetExchangesForLayoutQueryResult = Apollo.QueryResult<GetExchangesForLayoutQuery, GetExchangesForLayoutQueryVariables>;