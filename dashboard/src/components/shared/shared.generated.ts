import * as Types from '../../generated/types';

import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
const defaultOptions = {} as const;
export type GetRunnersForSelectorQueryVariables = Types.Exact<{
  ownerID?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;


export type GetRunnersForSelectorQuery = { __typename?: 'Query', myRunners: { __typename?: 'BotRunnerConnection', edges?: Array<{ __typename?: 'BotRunnerEdge', node?: { __typename?: 'BotRunner', id: string, name: string, type: Types.BotRunnerRunnerType, public: boolean, dataIsReady: boolean } | null } | null> | null }, publicRunners: { __typename?: 'BotRunnerConnection', edges?: Array<{ __typename?: 'BotRunnerEdge', node?: { __typename?: 'BotRunner', id: string, name: string, type: Types.BotRunnerRunnerType, public: boolean, dataIsReady: boolean, ownerID: string } | null } | null> | null } };


export const GetRunnersForSelectorDocument = gql`
    query GetRunnersForSelector($ownerID: String) {
  myRunners: botRunners(first: 50, where: {ownerID: $ownerID}) {
    edges {
      node {
        id
        name
        type
        public
        dataIsReady
      }
    }
  }
  publicRunners: botRunners(first: 50, where: {public: true}) {
    edges {
      node {
        id
        name
        type
        public
        dataIsReady
        ownerID
      }
    }
  }
}
    `;

/**
 * __useGetRunnersForSelectorQuery__
 *
 * To run a query within a React component, call `useGetRunnersForSelectorQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetRunnersForSelectorQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetRunnersForSelectorQuery({
 *   variables: {
 *      ownerID: // value for 'ownerID'
 *   },
 * });
 */
export function useGetRunnersForSelectorQuery(baseOptions?: Apollo.QueryHookOptions<GetRunnersForSelectorQuery, GetRunnersForSelectorQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetRunnersForSelectorQuery, GetRunnersForSelectorQueryVariables>(GetRunnersForSelectorDocument, options);
      }
export function useGetRunnersForSelectorLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetRunnersForSelectorQuery, GetRunnersForSelectorQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetRunnersForSelectorQuery, GetRunnersForSelectorQueryVariables>(GetRunnersForSelectorDocument, options);
        }
export function useGetRunnersForSelectorSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetRunnersForSelectorQuery, GetRunnersForSelectorQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetRunnersForSelectorQuery, GetRunnersForSelectorQueryVariables>(GetRunnersForSelectorDocument, options);
        }
export type GetRunnersForSelectorQueryHookResult = ReturnType<typeof useGetRunnersForSelectorQuery>;
export type GetRunnersForSelectorLazyQueryHookResult = ReturnType<typeof useGetRunnersForSelectorLazyQuery>;
export type GetRunnersForSelectorSuspenseQueryHookResult = ReturnType<typeof useGetRunnersForSelectorSuspenseQuery>;
export type GetRunnersForSelectorQueryResult = Apollo.QueryResult<GetRunnersForSelectorQuery, GetRunnersForSelectorQueryVariables>;