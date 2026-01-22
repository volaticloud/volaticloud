import * as Types from '../../generated/types';

import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
const defaultOptions = {} as const;
export type GetRunnersForSelectorQueryVariables = Types.Exact<{
  ownerID?: Types.InputMaybe<Types.Scalars['String']['input']>;
  search?: Types.InputMaybe<Types.Scalars['String']['input']>;
  includePublic: Types.Scalars['Boolean']['input'];
  dataReadyOnly?: Types.InputMaybe<Types.Scalars['Boolean']['input']>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['Cursor']['input']>;
}>;


export type GetRunnersForSelectorQuery = { __typename?: 'Query', myRunners: { __typename?: 'BotRunnerConnection', totalCount: number, edges?: Array<{ __typename?: 'BotRunnerEdge', node?: { __typename?: 'BotRunner', id: string, name: string, type: Types.BotRunnerRunnerType, public: boolean, dataIsReady: boolean } | null } | null> | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } }, publicRunners?: { __typename?: 'BotRunnerConnection', totalCount: number, edges?: Array<{ __typename?: 'BotRunnerEdge', node?: { __typename?: 'BotRunner', id: string, name: string, type: Types.BotRunnerRunnerType, public: boolean, dataIsReady: boolean, ownerID: string } | null } | null> | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type GetRunnerByIdQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type GetRunnerByIdQuery = { __typename?: 'Query', botRunners: { __typename?: 'BotRunnerConnection', edges?: Array<{ __typename?: 'BotRunnerEdge', node?: { __typename?: 'BotRunner', id: string, name: string, type: Types.BotRunnerRunnerType, public: boolean, dataIsReady: boolean, dataAvailable?: Record<string, any> | null } | null } | null> | null } };

export type GetBotsForSelectorQueryVariables = Types.Exact<{
  ownerID?: Types.InputMaybe<Types.Scalars['String']['input']>;
  search?: Types.InputMaybe<Types.Scalars['String']['input']>;
  includePublic: Types.Scalars['Boolean']['input'];
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['Cursor']['input']>;
}>;


export type GetBotsForSelectorQuery = { __typename?: 'Query', myBots: { __typename?: 'BotConnection', totalCount: number, edges?: Array<{ __typename?: 'BotEdge', node?: { __typename?: 'Bot', id: string, name: string, status: Types.BotBotStatus, public: boolean } | null } | null> | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } }, publicBots?: { __typename?: 'BotConnection', totalCount: number, edges?: Array<{ __typename?: 'BotEdge', node?: { __typename?: 'Bot', id: string, name: string, status: Types.BotBotStatus, public: boolean, ownerID: string } | null } | null> | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type GetBotByIdQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type GetBotByIdQuery = { __typename?: 'Query', bots: { __typename?: 'BotConnection', edges?: Array<{ __typename?: 'BotEdge', node?: { __typename?: 'Bot', id: string, name: string, status: Types.BotBotStatus, public: boolean } | null } | null> | null } };

export type GetStrategiesForSelectorQueryVariables = Types.Exact<{
  ownerID?: Types.InputMaybe<Types.Scalars['String']['input']>;
  search?: Types.InputMaybe<Types.Scalars['String']['input']>;
  includePublic: Types.Scalars['Boolean']['input'];
  latestOnly?: Types.InputMaybe<Types.Scalars['Boolean']['input']>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['Cursor']['input']>;
}>;


export type GetStrategiesForSelectorQuery = { __typename?: 'Query', myStrategies: { __typename?: 'StrategyConnection', totalCount: number, edges?: Array<{ __typename?: 'StrategyEdge', node?: { __typename?: 'Strategy', id: string, name: string, isLatest: boolean, versionNumber: number, public: boolean } | null } | null> | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } }, publicStrategies?: { __typename?: 'StrategyConnection', totalCount: number, edges?: Array<{ __typename?: 'StrategyEdge', node?: { __typename?: 'Strategy', id: string, name: string, isLatest: boolean, versionNumber: number, public: boolean, ownerID: string } | null } | null> | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type GetStrategyForSelectorQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type GetStrategyForSelectorQuery = { __typename?: 'Query', strategies: { __typename?: 'StrategyConnection', edges?: Array<{ __typename?: 'StrategyEdge', node?: { __typename?: 'Strategy', id: string, name: string, isLatest: boolean, versionNumber: number, public: boolean } | null } | null> | null } };


export const GetRunnersForSelectorDocument = gql`
    query GetRunnersForSelector($ownerID: String, $search: String, $includePublic: Boolean!, $dataReadyOnly: Boolean, $first: Int = 20, $after: Cursor) {
  myRunners: botRunners(
    first: $first
    after: $after
    where: {ownerID: $ownerID, nameContainsFold: $search, dataIsReady: $dataReadyOnly}
  ) {
    edges {
      node {
        id
        name
        type
        public
        dataIsReady
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
  publicRunners: botRunners(
    first: $first
    after: $after
    where: {public: true, ownerIDNEQ: $ownerID, nameContainsFold: $search, dataIsReady: $dataReadyOnly}
  ) @include(if: $includePublic) {
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
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
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
 *      search: // value for 'search'
 *      includePublic: // value for 'includePublic'
 *      dataReadyOnly: // value for 'dataReadyOnly'
 *      first: // value for 'first'
 *      after: // value for 'after'
 *   },
 * });
 */
export function useGetRunnersForSelectorQuery(baseOptions: Apollo.QueryHookOptions<GetRunnersForSelectorQuery, GetRunnersForSelectorQueryVariables> & ({ variables: GetRunnersForSelectorQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetRunnersForSelectorQuery, GetRunnersForSelectorQueryVariables>(GetRunnersForSelectorDocument, options);
      }
export function useGetRunnersForSelectorLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetRunnersForSelectorQuery, GetRunnersForSelectorQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetRunnersForSelectorQuery, GetRunnersForSelectorQueryVariables>(GetRunnersForSelectorDocument, options);
        }
// @ts-ignore
export function useGetRunnersForSelectorSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetRunnersForSelectorQuery, GetRunnersForSelectorQueryVariables>): Apollo.UseSuspenseQueryResult<GetRunnersForSelectorQuery, GetRunnersForSelectorQueryVariables>;
export function useGetRunnersForSelectorSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetRunnersForSelectorQuery, GetRunnersForSelectorQueryVariables>): Apollo.UseSuspenseQueryResult<GetRunnersForSelectorQuery | undefined, GetRunnersForSelectorQueryVariables>;
export function useGetRunnersForSelectorSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetRunnersForSelectorQuery, GetRunnersForSelectorQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetRunnersForSelectorQuery, GetRunnersForSelectorQueryVariables>(GetRunnersForSelectorDocument, options);
        }
export type GetRunnersForSelectorQueryHookResult = ReturnType<typeof useGetRunnersForSelectorQuery>;
export type GetRunnersForSelectorLazyQueryHookResult = ReturnType<typeof useGetRunnersForSelectorLazyQuery>;
export type GetRunnersForSelectorSuspenseQueryHookResult = ReturnType<typeof useGetRunnersForSelectorSuspenseQuery>;
export type GetRunnersForSelectorQueryResult = Apollo.QueryResult<GetRunnersForSelectorQuery, GetRunnersForSelectorQueryVariables>;
export const GetRunnerByIdDocument = gql`
    query GetRunnerById($id: ID!) {
  botRunners(first: 1, where: {id: $id}) {
    edges {
      node {
        id
        name
        type
        public
        dataIsReady
        dataAvailable
      }
    }
  }
}
    `;

/**
 * __useGetRunnerByIdQuery__
 *
 * To run a query within a React component, call `useGetRunnerByIdQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetRunnerByIdQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetRunnerByIdQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetRunnerByIdQuery(baseOptions: Apollo.QueryHookOptions<GetRunnerByIdQuery, GetRunnerByIdQueryVariables> & ({ variables: GetRunnerByIdQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetRunnerByIdQuery, GetRunnerByIdQueryVariables>(GetRunnerByIdDocument, options);
      }
export function useGetRunnerByIdLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetRunnerByIdQuery, GetRunnerByIdQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetRunnerByIdQuery, GetRunnerByIdQueryVariables>(GetRunnerByIdDocument, options);
        }
// @ts-ignore
export function useGetRunnerByIdSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetRunnerByIdQuery, GetRunnerByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetRunnerByIdQuery, GetRunnerByIdQueryVariables>;
export function useGetRunnerByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetRunnerByIdQuery, GetRunnerByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetRunnerByIdQuery | undefined, GetRunnerByIdQueryVariables>;
export function useGetRunnerByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetRunnerByIdQuery, GetRunnerByIdQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetRunnerByIdQuery, GetRunnerByIdQueryVariables>(GetRunnerByIdDocument, options);
        }
export type GetRunnerByIdQueryHookResult = ReturnType<typeof useGetRunnerByIdQuery>;
export type GetRunnerByIdLazyQueryHookResult = ReturnType<typeof useGetRunnerByIdLazyQuery>;
export type GetRunnerByIdSuspenseQueryHookResult = ReturnType<typeof useGetRunnerByIdSuspenseQuery>;
export type GetRunnerByIdQueryResult = Apollo.QueryResult<GetRunnerByIdQuery, GetRunnerByIdQueryVariables>;
export const GetBotsForSelectorDocument = gql`
    query GetBotsForSelector($ownerID: String, $search: String, $includePublic: Boolean!, $first: Int = 20, $after: Cursor) {
  myBots: bots(
    first: $first
    after: $after
    where: {ownerID: $ownerID, nameContainsFold: $search}
  ) {
    edges {
      node {
        id
        name
        status
        public
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
  publicBots: bots(
    first: $first
    after: $after
    where: {public: true, ownerIDNEQ: $ownerID, nameContainsFold: $search}
  ) @include(if: $includePublic) {
    edges {
      node {
        id
        name
        status
        public
        ownerID
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
    `;

/**
 * __useGetBotsForSelectorQuery__
 *
 * To run a query within a React component, call `useGetBotsForSelectorQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetBotsForSelectorQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetBotsForSelectorQuery({
 *   variables: {
 *      ownerID: // value for 'ownerID'
 *      search: // value for 'search'
 *      includePublic: // value for 'includePublic'
 *      first: // value for 'first'
 *      after: // value for 'after'
 *   },
 * });
 */
export function useGetBotsForSelectorQuery(baseOptions: Apollo.QueryHookOptions<GetBotsForSelectorQuery, GetBotsForSelectorQueryVariables> & ({ variables: GetBotsForSelectorQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetBotsForSelectorQuery, GetBotsForSelectorQueryVariables>(GetBotsForSelectorDocument, options);
      }
export function useGetBotsForSelectorLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetBotsForSelectorQuery, GetBotsForSelectorQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetBotsForSelectorQuery, GetBotsForSelectorQueryVariables>(GetBotsForSelectorDocument, options);
        }
// @ts-ignore
export function useGetBotsForSelectorSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetBotsForSelectorQuery, GetBotsForSelectorQueryVariables>): Apollo.UseSuspenseQueryResult<GetBotsForSelectorQuery, GetBotsForSelectorQueryVariables>;
export function useGetBotsForSelectorSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetBotsForSelectorQuery, GetBotsForSelectorQueryVariables>): Apollo.UseSuspenseQueryResult<GetBotsForSelectorQuery | undefined, GetBotsForSelectorQueryVariables>;
export function useGetBotsForSelectorSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetBotsForSelectorQuery, GetBotsForSelectorQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetBotsForSelectorQuery, GetBotsForSelectorQueryVariables>(GetBotsForSelectorDocument, options);
        }
export type GetBotsForSelectorQueryHookResult = ReturnType<typeof useGetBotsForSelectorQuery>;
export type GetBotsForSelectorLazyQueryHookResult = ReturnType<typeof useGetBotsForSelectorLazyQuery>;
export type GetBotsForSelectorSuspenseQueryHookResult = ReturnType<typeof useGetBotsForSelectorSuspenseQuery>;
export type GetBotsForSelectorQueryResult = Apollo.QueryResult<GetBotsForSelectorQuery, GetBotsForSelectorQueryVariables>;
export const GetBotByIdDocument = gql`
    query GetBotById($id: ID!) {
  bots(first: 1, where: {id: $id}) {
    edges {
      node {
        id
        name
        status
        public
      }
    }
  }
}
    `;

/**
 * __useGetBotByIdQuery__
 *
 * To run a query within a React component, call `useGetBotByIdQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetBotByIdQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetBotByIdQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetBotByIdQuery(baseOptions: Apollo.QueryHookOptions<GetBotByIdQuery, GetBotByIdQueryVariables> & ({ variables: GetBotByIdQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetBotByIdQuery, GetBotByIdQueryVariables>(GetBotByIdDocument, options);
      }
export function useGetBotByIdLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetBotByIdQuery, GetBotByIdQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetBotByIdQuery, GetBotByIdQueryVariables>(GetBotByIdDocument, options);
        }
// @ts-ignore
export function useGetBotByIdSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetBotByIdQuery, GetBotByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetBotByIdQuery, GetBotByIdQueryVariables>;
export function useGetBotByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetBotByIdQuery, GetBotByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetBotByIdQuery | undefined, GetBotByIdQueryVariables>;
export function useGetBotByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetBotByIdQuery, GetBotByIdQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetBotByIdQuery, GetBotByIdQueryVariables>(GetBotByIdDocument, options);
        }
export type GetBotByIdQueryHookResult = ReturnType<typeof useGetBotByIdQuery>;
export type GetBotByIdLazyQueryHookResult = ReturnType<typeof useGetBotByIdLazyQuery>;
export type GetBotByIdSuspenseQueryHookResult = ReturnType<typeof useGetBotByIdSuspenseQuery>;
export type GetBotByIdQueryResult = Apollo.QueryResult<GetBotByIdQuery, GetBotByIdQueryVariables>;
export const GetStrategiesForSelectorDocument = gql`
    query GetStrategiesForSelector($ownerID: String, $search: String, $includePublic: Boolean!, $latestOnly: Boolean, $first: Int = 20, $after: Cursor) {
  myStrategies: strategies(
    first: $first
    after: $after
    where: {ownerID: $ownerID, nameContainsFold: $search, isLatest: $latestOnly}
  ) {
    edges {
      node {
        id
        name
        isLatest
        versionNumber
        public
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
  publicStrategies: strategies(
    first: $first
    after: $after
    where: {public: true, ownerIDNEQ: $ownerID, nameContainsFold: $search, isLatest: $latestOnly}
  ) @include(if: $includePublic) {
    edges {
      node {
        id
        name
        isLatest
        versionNumber
        public
        ownerID
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
    `;

/**
 * __useGetStrategiesForSelectorQuery__
 *
 * To run a query within a React component, call `useGetStrategiesForSelectorQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetStrategiesForSelectorQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetStrategiesForSelectorQuery({
 *   variables: {
 *      ownerID: // value for 'ownerID'
 *      search: // value for 'search'
 *      includePublic: // value for 'includePublic'
 *      latestOnly: // value for 'latestOnly'
 *      first: // value for 'first'
 *      after: // value for 'after'
 *   },
 * });
 */
export function useGetStrategiesForSelectorQuery(baseOptions: Apollo.QueryHookOptions<GetStrategiesForSelectorQuery, GetStrategiesForSelectorQueryVariables> & ({ variables: GetStrategiesForSelectorQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetStrategiesForSelectorQuery, GetStrategiesForSelectorQueryVariables>(GetStrategiesForSelectorDocument, options);
      }
export function useGetStrategiesForSelectorLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetStrategiesForSelectorQuery, GetStrategiesForSelectorQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetStrategiesForSelectorQuery, GetStrategiesForSelectorQueryVariables>(GetStrategiesForSelectorDocument, options);
        }
// @ts-ignore
export function useGetStrategiesForSelectorSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetStrategiesForSelectorQuery, GetStrategiesForSelectorQueryVariables>): Apollo.UseSuspenseQueryResult<GetStrategiesForSelectorQuery, GetStrategiesForSelectorQueryVariables>;
export function useGetStrategiesForSelectorSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetStrategiesForSelectorQuery, GetStrategiesForSelectorQueryVariables>): Apollo.UseSuspenseQueryResult<GetStrategiesForSelectorQuery | undefined, GetStrategiesForSelectorQueryVariables>;
export function useGetStrategiesForSelectorSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetStrategiesForSelectorQuery, GetStrategiesForSelectorQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetStrategiesForSelectorQuery, GetStrategiesForSelectorQueryVariables>(GetStrategiesForSelectorDocument, options);
        }
export type GetStrategiesForSelectorQueryHookResult = ReturnType<typeof useGetStrategiesForSelectorQuery>;
export type GetStrategiesForSelectorLazyQueryHookResult = ReturnType<typeof useGetStrategiesForSelectorLazyQuery>;
export type GetStrategiesForSelectorSuspenseQueryHookResult = ReturnType<typeof useGetStrategiesForSelectorSuspenseQuery>;
export type GetStrategiesForSelectorQueryResult = Apollo.QueryResult<GetStrategiesForSelectorQuery, GetStrategiesForSelectorQueryVariables>;
export const GetStrategyForSelectorDocument = gql`
    query GetStrategyForSelector($id: ID!) {
  strategies(first: 1, where: {id: $id}) {
    edges {
      node {
        id
        name
        isLatest
        versionNumber
        public
      }
    }
  }
}
    `;

/**
 * __useGetStrategyForSelectorQuery__
 *
 * To run a query within a React component, call `useGetStrategyForSelectorQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetStrategyForSelectorQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetStrategyForSelectorQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetStrategyForSelectorQuery(baseOptions: Apollo.QueryHookOptions<GetStrategyForSelectorQuery, GetStrategyForSelectorQueryVariables> & ({ variables: GetStrategyForSelectorQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetStrategyForSelectorQuery, GetStrategyForSelectorQueryVariables>(GetStrategyForSelectorDocument, options);
      }
export function useGetStrategyForSelectorLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetStrategyForSelectorQuery, GetStrategyForSelectorQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetStrategyForSelectorQuery, GetStrategyForSelectorQueryVariables>(GetStrategyForSelectorDocument, options);
        }
// @ts-ignore
export function useGetStrategyForSelectorSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetStrategyForSelectorQuery, GetStrategyForSelectorQueryVariables>): Apollo.UseSuspenseQueryResult<GetStrategyForSelectorQuery, GetStrategyForSelectorQueryVariables>;
export function useGetStrategyForSelectorSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetStrategyForSelectorQuery, GetStrategyForSelectorQueryVariables>): Apollo.UseSuspenseQueryResult<GetStrategyForSelectorQuery | undefined, GetStrategyForSelectorQueryVariables>;
export function useGetStrategyForSelectorSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetStrategyForSelectorQuery, GetStrategyForSelectorQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetStrategyForSelectorQuery, GetStrategyForSelectorQueryVariables>(GetStrategyForSelectorDocument, options);
        }
export type GetStrategyForSelectorQueryHookResult = ReturnType<typeof useGetStrategyForSelectorQuery>;
export type GetStrategyForSelectorLazyQueryHookResult = ReturnType<typeof useGetStrategyForSelectorLazyQuery>;
export type GetStrategyForSelectorSuspenseQueryHookResult = ReturnType<typeof useGetStrategyForSelectorSuspenseQuery>;
export type GetStrategyForSelectorQueryResult = Apollo.QueryResult<GetStrategyForSelectorQuery, GetStrategyForSelectorQueryVariables>;