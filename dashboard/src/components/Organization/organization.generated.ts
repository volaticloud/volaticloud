import * as Types from '../../generated/types';

import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
const defaultOptions = {} as const;
export type OrganizationUsersQueryVariables = Types.Exact<{
  organizationId: Types.Scalars['String']['input'];
}>;


export type OrganizationUsersQuery = { __typename?: 'Query', organizationUsers: Array<{ __typename?: 'OrganizationUser', id: string, username: string, email?: string | null, emailVerified: boolean, firstName?: string | null, lastName?: string | null, enabled: boolean, createdAt: string }> };

export type OrganizationGroupTreeQueryVariables = Types.Exact<{
  organizationId: Types.Scalars['String']['input'];
}>;


export type OrganizationGroupTreeQuery = { __typename?: 'Query', organizationGroupTree: { __typename?: 'GroupNode', id: string, name: string, path: string, type: string, title: string, children: Array<{ __typename?: 'GroupNode', id: string, name: string, path: string, type: string, title: string, children: Array<{ __typename?: 'GroupNode', id: string, name: string, path: string, type: string, title: string, children: Array<{ __typename?: 'GroupNode', id: string, name: string, path: string, type: string, title: string }> }> }> } };

export type GroupMembersQueryVariables = Types.Exact<{
  organizationId: Types.Scalars['String']['input'];
  groupId: Types.Scalars['String']['input'];
}>;


export type GroupMembersQuery = { __typename?: 'Query', groupMembers: Array<{ __typename?: 'OrganizationUser', id: string, username: string, email?: string | null, emailVerified: boolean, firstName?: string | null, lastName?: string | null, enabled: boolean, createdAt: string }> };

export type ResourceGroupsQueryVariables = Types.Exact<{
  organizationId: Types.Scalars['String']['input'];
  where?: Types.InputMaybe<Types.ResourceGroupWhereInput>;
  orderBy?: Types.InputMaybe<Types.ResourceGroupOrder>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  offset?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type ResourceGroupsQuery = { __typename?: 'Query', resourceGroups: { __typename?: 'ResourceGroupConnection', totalCount: number, edges: Array<{ __typename?: 'ResourceGroupEdge', cursor: string, node: { __typename?: 'ResourceGroup', name: string, path: string, title: string, type: string, totalMembers: number, hasChildren: boolean, roles: Array<{ __typename?: 'RoleInfo', name: string, memberCount: number }> } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type ResourceGroupMembersQueryVariables = Types.Exact<{
  organizationId: Types.Scalars['String']['input'];
  resourceGroupId: Types.Scalars['String']['input'];
  where?: Types.InputMaybe<Types.ResourceGroupMemberWhereInput>;
  orderBy?: Types.InputMaybe<Types.ResourceGroupMemberOrder>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  offset?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type ResourceGroupMembersQuery = { __typename?: 'Query', resourceGroupMembers: { __typename?: 'ResourceGroupMemberConnection', totalCount: number, availableRoles: Array<string>, edges: Array<{ __typename?: 'ResourceGroupMemberEdge', cursor: string, node: { __typename?: 'ResourceGroupMember', roles: Array<string>, primaryRole: string, user: { __typename?: 'MemberUser', id: string, username: string, email?: string | null, emailVerified: boolean, firstName?: string | null, lastName?: string | null, enabled: boolean, createdAt: string } } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type InviteOrganizationUserMutationVariables = Types.Exact<{
  organizationId: Types.Scalars['ID']['input'];
  input: Types.InviteUserInput;
}>;


export type InviteOrganizationUserMutation = { __typename?: 'Mutation', inviteOrganizationUser: { __typename?: 'OrganizationInvitation', id: string, email: string, firstName?: string | null, lastName?: string | null, organizationId: string, status: string, createdAt: string, expiresAt: string } };

export type ChangeOrganizationUserRoleMutationVariables = Types.Exact<{
  organizationId: Types.Scalars['ID']['input'];
  userId: Types.Scalars['ID']['input'];
  newRole: Types.Scalars['String']['input'];
}>;


export type ChangeOrganizationUserRoleMutation = { __typename?: 'Mutation', changeOrganizationUserRole: boolean };


export const OrganizationUsersDocument = gql`
    query OrganizationUsers($organizationId: String!) {
  organizationUsers(organizationId: $organizationId) {
    id
    username
    email
    emailVerified
    firstName
    lastName
    enabled
    createdAt
  }
}
    `;

/**
 * __useOrganizationUsersQuery__
 *
 * To run a query within a React component, call `useOrganizationUsersQuery` and pass it any options that fit your needs.
 * When your component renders, `useOrganizationUsersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useOrganizationUsersQuery({
 *   variables: {
 *      organizationId: // value for 'organizationId'
 *   },
 * });
 */
export function useOrganizationUsersQuery(baseOptions: Apollo.QueryHookOptions<OrganizationUsersQuery, OrganizationUsersQueryVariables> & ({ variables: OrganizationUsersQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<OrganizationUsersQuery, OrganizationUsersQueryVariables>(OrganizationUsersDocument, options);
      }
export function useOrganizationUsersLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<OrganizationUsersQuery, OrganizationUsersQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<OrganizationUsersQuery, OrganizationUsersQueryVariables>(OrganizationUsersDocument, options);
        }
// @ts-ignore
export function useOrganizationUsersSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<OrganizationUsersQuery, OrganizationUsersQueryVariables>): Apollo.UseSuspenseQueryResult<OrganizationUsersQuery, OrganizationUsersQueryVariables>;
export function useOrganizationUsersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<OrganizationUsersQuery, OrganizationUsersQueryVariables>): Apollo.UseSuspenseQueryResult<OrganizationUsersQuery | undefined, OrganizationUsersQueryVariables>;
export function useOrganizationUsersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<OrganizationUsersQuery, OrganizationUsersQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<OrganizationUsersQuery, OrganizationUsersQueryVariables>(OrganizationUsersDocument, options);
        }
export type OrganizationUsersQueryHookResult = ReturnType<typeof useOrganizationUsersQuery>;
export type OrganizationUsersLazyQueryHookResult = ReturnType<typeof useOrganizationUsersLazyQuery>;
export type OrganizationUsersSuspenseQueryHookResult = ReturnType<typeof useOrganizationUsersSuspenseQuery>;
export type OrganizationUsersQueryResult = Apollo.QueryResult<OrganizationUsersQuery, OrganizationUsersQueryVariables>;
export const OrganizationGroupTreeDocument = gql`
    query OrganizationGroupTree($organizationId: String!) {
  organizationGroupTree(organizationId: $organizationId) {
    id
    name
    path
    type
    title
    children {
      id
      name
      path
      type
      title
      children {
        id
        name
        path
        type
        title
        children {
          id
          name
          path
          type
          title
        }
      }
    }
  }
}
    `;

/**
 * __useOrganizationGroupTreeQuery__
 *
 * To run a query within a React component, call `useOrganizationGroupTreeQuery` and pass it any options that fit your needs.
 * When your component renders, `useOrganizationGroupTreeQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useOrganizationGroupTreeQuery({
 *   variables: {
 *      organizationId: // value for 'organizationId'
 *   },
 * });
 */
export function useOrganizationGroupTreeQuery(baseOptions: Apollo.QueryHookOptions<OrganizationGroupTreeQuery, OrganizationGroupTreeQueryVariables> & ({ variables: OrganizationGroupTreeQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<OrganizationGroupTreeQuery, OrganizationGroupTreeQueryVariables>(OrganizationGroupTreeDocument, options);
      }
export function useOrganizationGroupTreeLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<OrganizationGroupTreeQuery, OrganizationGroupTreeQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<OrganizationGroupTreeQuery, OrganizationGroupTreeQueryVariables>(OrganizationGroupTreeDocument, options);
        }
// @ts-ignore
export function useOrganizationGroupTreeSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<OrganizationGroupTreeQuery, OrganizationGroupTreeQueryVariables>): Apollo.UseSuspenseQueryResult<OrganizationGroupTreeQuery, OrganizationGroupTreeQueryVariables>;
export function useOrganizationGroupTreeSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<OrganizationGroupTreeQuery, OrganizationGroupTreeQueryVariables>): Apollo.UseSuspenseQueryResult<OrganizationGroupTreeQuery | undefined, OrganizationGroupTreeQueryVariables>;
export function useOrganizationGroupTreeSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<OrganizationGroupTreeQuery, OrganizationGroupTreeQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<OrganizationGroupTreeQuery, OrganizationGroupTreeQueryVariables>(OrganizationGroupTreeDocument, options);
        }
export type OrganizationGroupTreeQueryHookResult = ReturnType<typeof useOrganizationGroupTreeQuery>;
export type OrganizationGroupTreeLazyQueryHookResult = ReturnType<typeof useOrganizationGroupTreeLazyQuery>;
export type OrganizationGroupTreeSuspenseQueryHookResult = ReturnType<typeof useOrganizationGroupTreeSuspenseQuery>;
export type OrganizationGroupTreeQueryResult = Apollo.QueryResult<OrganizationGroupTreeQuery, OrganizationGroupTreeQueryVariables>;
export const GroupMembersDocument = gql`
    query GroupMembers($organizationId: String!, $groupId: String!) {
  groupMembers(organizationId: $organizationId, groupId: $groupId) {
    id
    username
    email
    emailVerified
    firstName
    lastName
    enabled
    createdAt
  }
}
    `;

/**
 * __useGroupMembersQuery__
 *
 * To run a query within a React component, call `useGroupMembersQuery` and pass it any options that fit your needs.
 * When your component renders, `useGroupMembersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGroupMembersQuery({
 *   variables: {
 *      organizationId: // value for 'organizationId'
 *      groupId: // value for 'groupId'
 *   },
 * });
 */
export function useGroupMembersQuery(baseOptions: Apollo.QueryHookOptions<GroupMembersQuery, GroupMembersQueryVariables> & ({ variables: GroupMembersQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GroupMembersQuery, GroupMembersQueryVariables>(GroupMembersDocument, options);
      }
export function useGroupMembersLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GroupMembersQuery, GroupMembersQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GroupMembersQuery, GroupMembersQueryVariables>(GroupMembersDocument, options);
        }
// @ts-ignore
export function useGroupMembersSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GroupMembersQuery, GroupMembersQueryVariables>): Apollo.UseSuspenseQueryResult<GroupMembersQuery, GroupMembersQueryVariables>;
export function useGroupMembersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GroupMembersQuery, GroupMembersQueryVariables>): Apollo.UseSuspenseQueryResult<GroupMembersQuery | undefined, GroupMembersQueryVariables>;
export function useGroupMembersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GroupMembersQuery, GroupMembersQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GroupMembersQuery, GroupMembersQueryVariables>(GroupMembersDocument, options);
        }
export type GroupMembersQueryHookResult = ReturnType<typeof useGroupMembersQuery>;
export type GroupMembersLazyQueryHookResult = ReturnType<typeof useGroupMembersLazyQuery>;
export type GroupMembersSuspenseQueryHookResult = ReturnType<typeof useGroupMembersSuspenseQuery>;
export type GroupMembersQueryResult = Apollo.QueryResult<GroupMembersQuery, GroupMembersQueryVariables>;
export const ResourceGroupsDocument = gql`
    query ResourceGroups($organizationId: String!, $where: ResourceGroupWhereInput, $orderBy: ResourceGroupOrder, $first: Int, $offset: Int) {
  resourceGroups(
    organizationId: $organizationId
    where: $where
    orderBy: $orderBy
    first: $first
    offset: $offset
  ) {
    edges {
      node {
        name
        path
        title
        type
        roles {
          name
          memberCount
        }
        totalMembers
        hasChildren
      }
      cursor
    }
    totalCount
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
  }
}
    `;

/**
 * __useResourceGroupsQuery__
 *
 * To run a query within a React component, call `useResourceGroupsQuery` and pass it any options that fit your needs.
 * When your component renders, `useResourceGroupsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useResourceGroupsQuery({
 *   variables: {
 *      organizationId: // value for 'organizationId'
 *      where: // value for 'where'
 *      orderBy: // value for 'orderBy'
 *      first: // value for 'first'
 *      offset: // value for 'offset'
 *   },
 * });
 */
export function useResourceGroupsQuery(baseOptions: Apollo.QueryHookOptions<ResourceGroupsQuery, ResourceGroupsQueryVariables> & ({ variables: ResourceGroupsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ResourceGroupsQuery, ResourceGroupsQueryVariables>(ResourceGroupsDocument, options);
      }
export function useResourceGroupsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ResourceGroupsQuery, ResourceGroupsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ResourceGroupsQuery, ResourceGroupsQueryVariables>(ResourceGroupsDocument, options);
        }
// @ts-ignore
export function useResourceGroupsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<ResourceGroupsQuery, ResourceGroupsQueryVariables>): Apollo.UseSuspenseQueryResult<ResourceGroupsQuery, ResourceGroupsQueryVariables>;
export function useResourceGroupsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ResourceGroupsQuery, ResourceGroupsQueryVariables>): Apollo.UseSuspenseQueryResult<ResourceGroupsQuery | undefined, ResourceGroupsQueryVariables>;
export function useResourceGroupsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ResourceGroupsQuery, ResourceGroupsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ResourceGroupsQuery, ResourceGroupsQueryVariables>(ResourceGroupsDocument, options);
        }
export type ResourceGroupsQueryHookResult = ReturnType<typeof useResourceGroupsQuery>;
export type ResourceGroupsLazyQueryHookResult = ReturnType<typeof useResourceGroupsLazyQuery>;
export type ResourceGroupsSuspenseQueryHookResult = ReturnType<typeof useResourceGroupsSuspenseQuery>;
export type ResourceGroupsQueryResult = Apollo.QueryResult<ResourceGroupsQuery, ResourceGroupsQueryVariables>;
export const ResourceGroupMembersDocument = gql`
    query ResourceGroupMembers($organizationId: String!, $resourceGroupId: String!, $where: ResourceGroupMemberWhereInput, $orderBy: ResourceGroupMemberOrder, $first: Int, $offset: Int) {
  resourceGroupMembers(
    organizationId: $organizationId
    resourceGroupId: $resourceGroupId
    where: $where
    orderBy: $orderBy
    first: $first
    offset: $offset
  ) {
    edges {
      node {
        user {
          id
          username
          email
          emailVerified
          firstName
          lastName
          enabled
          createdAt
        }
        roles
        primaryRole
      }
      cursor
    }
    totalCount
    availableRoles
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
  }
}
    `;

/**
 * __useResourceGroupMembersQuery__
 *
 * To run a query within a React component, call `useResourceGroupMembersQuery` and pass it any options that fit your needs.
 * When your component renders, `useResourceGroupMembersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useResourceGroupMembersQuery({
 *   variables: {
 *      organizationId: // value for 'organizationId'
 *      resourceGroupId: // value for 'resourceGroupId'
 *      where: // value for 'where'
 *      orderBy: // value for 'orderBy'
 *      first: // value for 'first'
 *      offset: // value for 'offset'
 *   },
 * });
 */
export function useResourceGroupMembersQuery(baseOptions: Apollo.QueryHookOptions<ResourceGroupMembersQuery, ResourceGroupMembersQueryVariables> & ({ variables: ResourceGroupMembersQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ResourceGroupMembersQuery, ResourceGroupMembersQueryVariables>(ResourceGroupMembersDocument, options);
      }
export function useResourceGroupMembersLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ResourceGroupMembersQuery, ResourceGroupMembersQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ResourceGroupMembersQuery, ResourceGroupMembersQueryVariables>(ResourceGroupMembersDocument, options);
        }
// @ts-ignore
export function useResourceGroupMembersSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<ResourceGroupMembersQuery, ResourceGroupMembersQueryVariables>): Apollo.UseSuspenseQueryResult<ResourceGroupMembersQuery, ResourceGroupMembersQueryVariables>;
export function useResourceGroupMembersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ResourceGroupMembersQuery, ResourceGroupMembersQueryVariables>): Apollo.UseSuspenseQueryResult<ResourceGroupMembersQuery | undefined, ResourceGroupMembersQueryVariables>;
export function useResourceGroupMembersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ResourceGroupMembersQuery, ResourceGroupMembersQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ResourceGroupMembersQuery, ResourceGroupMembersQueryVariables>(ResourceGroupMembersDocument, options);
        }
export type ResourceGroupMembersQueryHookResult = ReturnType<typeof useResourceGroupMembersQuery>;
export type ResourceGroupMembersLazyQueryHookResult = ReturnType<typeof useResourceGroupMembersLazyQuery>;
export type ResourceGroupMembersSuspenseQueryHookResult = ReturnType<typeof useResourceGroupMembersSuspenseQuery>;
export type ResourceGroupMembersQueryResult = Apollo.QueryResult<ResourceGroupMembersQuery, ResourceGroupMembersQueryVariables>;
export const InviteOrganizationUserDocument = gql`
    mutation InviteOrganizationUser($organizationId: ID!, $input: InviteUserInput!) {
  inviteOrganizationUser(organizationId: $organizationId, input: $input) {
    id
    email
    firstName
    lastName
    organizationId
    status
    createdAt
    expiresAt
  }
}
    `;
export type InviteOrganizationUserMutationFn = Apollo.MutationFunction<InviteOrganizationUserMutation, InviteOrganizationUserMutationVariables>;

/**
 * __useInviteOrganizationUserMutation__
 *
 * To run a mutation, you first call `useInviteOrganizationUserMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useInviteOrganizationUserMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [inviteOrganizationUserMutation, { data, loading, error }] = useInviteOrganizationUserMutation({
 *   variables: {
 *      organizationId: // value for 'organizationId'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useInviteOrganizationUserMutation(baseOptions?: Apollo.MutationHookOptions<InviteOrganizationUserMutation, InviteOrganizationUserMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<InviteOrganizationUserMutation, InviteOrganizationUserMutationVariables>(InviteOrganizationUserDocument, options);
      }
export type InviteOrganizationUserMutationHookResult = ReturnType<typeof useInviteOrganizationUserMutation>;
export type InviteOrganizationUserMutationResult = Apollo.MutationResult<InviteOrganizationUserMutation>;
export type InviteOrganizationUserMutationOptions = Apollo.BaseMutationOptions<InviteOrganizationUserMutation, InviteOrganizationUserMutationVariables>;
export const ChangeOrganizationUserRoleDocument = gql`
    mutation ChangeOrganizationUserRole($organizationId: ID!, $userId: ID!, $newRole: String!) {
  changeOrganizationUserRole(
    organizationId: $organizationId
    userId: $userId
    newRole: $newRole
  )
}
    `;
export type ChangeOrganizationUserRoleMutationFn = Apollo.MutationFunction<ChangeOrganizationUserRoleMutation, ChangeOrganizationUserRoleMutationVariables>;

/**
 * __useChangeOrganizationUserRoleMutation__
 *
 * To run a mutation, you first call `useChangeOrganizationUserRoleMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useChangeOrganizationUserRoleMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [changeOrganizationUserRoleMutation, { data, loading, error }] = useChangeOrganizationUserRoleMutation({
 *   variables: {
 *      organizationId: // value for 'organizationId'
 *      userId: // value for 'userId'
 *      newRole: // value for 'newRole'
 *   },
 * });
 */
export function useChangeOrganizationUserRoleMutation(baseOptions?: Apollo.MutationHookOptions<ChangeOrganizationUserRoleMutation, ChangeOrganizationUserRoleMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ChangeOrganizationUserRoleMutation, ChangeOrganizationUserRoleMutationVariables>(ChangeOrganizationUserRoleDocument, options);
      }
export type ChangeOrganizationUserRoleMutationHookResult = ReturnType<typeof useChangeOrganizationUserRoleMutation>;
export type ChangeOrganizationUserRoleMutationResult = Apollo.MutationResult<ChangeOrganizationUserRoleMutation>;
export type ChangeOrganizationUserRoleMutationOptions = Apollo.BaseMutationOptions<ChangeOrganizationUserRoleMutation, ChangeOrganizationUserRoleMutationVariables>;