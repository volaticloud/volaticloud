import * as Types from '../../generated/types';

import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
const defaultOptions = {} as const;
export type GetCreditBalanceQueryVariables = Types.Exact<{
  ownerID: Types.Scalars['String']['input'];
}>;


export type GetCreditBalanceQuery = { __typename?: 'Query', creditBalance: { __typename?: 'CreditBalance', balance: number, suspended: boolean, suspendedAt?: string | null } };

export type GetCreditTransactionsQueryVariables = Types.Exact<{
  ownerID: Types.Scalars['String']['input'];
  limit?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  offset?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type GetCreditTransactionsQuery = { __typename?: 'Query', creditTransactions: Array<{ __typename?: 'CreditTransaction', id: string, amount: number, balanceAfter: number, type: Types.CreditTransactionType, description?: string | null, referenceID?: string | null, createdAt: string }> };

export type GetSubscriptionInfoQueryVariables = Types.Exact<{
  ownerID: Types.Scalars['String']['input'];
}>;


export type GetSubscriptionInfoQuery = { __typename?: 'Query', subscriptionInfo?: { __typename?: 'SubscriptionInfo', planName?: string | null, monthlyDeposit: number, status: string, currentPeriodEnd: string, features: Array<string> } | null };

export type GetAvailablePlansQueryVariables = Types.Exact<{ [key: string]: never; }>;


export type GetAvailablePlansQuery = { __typename?: 'Query', availablePlans: Array<{ __typename?: 'PlanInfo', priceId: string, productId: string, displayName: string, description: string, priceAmount: number, monthlyDeposit: number, features: Array<string>, displayOrder: number }> };

export type CreateDepositSessionMutationVariables = Types.Exact<{
  ownerID: Types.Scalars['String']['input'];
  amount: Types.Scalars['Float']['input'];
}>;


export type CreateDepositSessionMutation = { __typename?: 'Mutation', createDepositSession: string };

export type CreateSubscriptionSessionMutationVariables = Types.Exact<{
  ownerID: Types.Scalars['String']['input'];
  priceID: Types.Scalars['String']['input'];
}>;


export type CreateSubscriptionSessionMutation = { __typename?: 'Mutation', createSubscriptionSession: string };

export type ChangeSubscriptionPlanMutationVariables = Types.Exact<{
  ownerID: Types.Scalars['String']['input'];
  newPriceID: Types.Scalars['String']['input'];
}>;


export type ChangeSubscriptionPlanMutation = { __typename?: 'Mutation', changeSubscriptionPlan: { __typename?: 'SubscriptionInfo', planName?: string | null, monthlyDeposit: number, status: string, currentPeriodEnd: string, features: Array<string> } };

export type CancelSubscriptionMutationVariables = Types.Exact<{
  ownerID: Types.Scalars['String']['input'];
}>;


export type CancelSubscriptionMutation = { __typename?: 'Mutation', cancelSubscription: { __typename?: 'SubscriptionInfo', planName?: string | null, monthlyDeposit: number, status: string, currentPeriodEnd: string, features: Array<string> } };

export type GetPaymentHistoryQueryVariables = Types.Exact<{
  ownerID: Types.Scalars['String']['input'];
  limit?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type GetPaymentHistoryQuery = { __typename?: 'Query', paymentHistory: Array<{ __typename?: 'StripeInvoice', id: string, number?: string | null, amountPaid: number, status: string, created: string, hostedInvoiceUrl?: string | null, invoicePdf?: string | null, billingReason?: string | null, periodStart: string, periodEnd: string }> };


export const GetCreditBalanceDocument = gql`
    query GetCreditBalance($ownerID: String!) {
  creditBalance(ownerID: $ownerID) {
    balance
    suspended
    suspendedAt
  }
}
    `;

/**
 * __useGetCreditBalanceQuery__
 *
 * To run a query within a React component, call `useGetCreditBalanceQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetCreditBalanceQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetCreditBalanceQuery({
 *   variables: {
 *      ownerID: // value for 'ownerID'
 *   },
 * });
 */
export function useGetCreditBalanceQuery(baseOptions: Apollo.QueryHookOptions<GetCreditBalanceQuery, GetCreditBalanceQueryVariables> & ({ variables: GetCreditBalanceQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetCreditBalanceQuery, GetCreditBalanceQueryVariables>(GetCreditBalanceDocument, options);
      }
export function useGetCreditBalanceLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetCreditBalanceQuery, GetCreditBalanceQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetCreditBalanceQuery, GetCreditBalanceQueryVariables>(GetCreditBalanceDocument, options);
        }
// @ts-ignore
export function useGetCreditBalanceSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetCreditBalanceQuery, GetCreditBalanceQueryVariables>): Apollo.UseSuspenseQueryResult<GetCreditBalanceQuery, GetCreditBalanceQueryVariables>;
export function useGetCreditBalanceSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetCreditBalanceQuery, GetCreditBalanceQueryVariables>): Apollo.UseSuspenseQueryResult<GetCreditBalanceQuery | undefined, GetCreditBalanceQueryVariables>;
export function useGetCreditBalanceSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetCreditBalanceQuery, GetCreditBalanceQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetCreditBalanceQuery, GetCreditBalanceQueryVariables>(GetCreditBalanceDocument, options);
        }
export type GetCreditBalanceQueryHookResult = ReturnType<typeof useGetCreditBalanceQuery>;
export type GetCreditBalanceLazyQueryHookResult = ReturnType<typeof useGetCreditBalanceLazyQuery>;
export type GetCreditBalanceSuspenseQueryHookResult = ReturnType<typeof useGetCreditBalanceSuspenseQuery>;
export type GetCreditBalanceQueryResult = Apollo.QueryResult<GetCreditBalanceQuery, GetCreditBalanceQueryVariables>;
export const GetCreditTransactionsDocument = gql`
    query GetCreditTransactions($ownerID: String!, $limit: Int, $offset: Int) {
  creditTransactions(ownerID: $ownerID, limit: $limit, offset: $offset) {
    id
    amount
    balanceAfter
    type
    description
    referenceID
    createdAt
  }
}
    `;

/**
 * __useGetCreditTransactionsQuery__
 *
 * To run a query within a React component, call `useGetCreditTransactionsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetCreditTransactionsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetCreditTransactionsQuery({
 *   variables: {
 *      ownerID: // value for 'ownerID'
 *      limit: // value for 'limit'
 *      offset: // value for 'offset'
 *   },
 * });
 */
export function useGetCreditTransactionsQuery(baseOptions: Apollo.QueryHookOptions<GetCreditTransactionsQuery, GetCreditTransactionsQueryVariables> & ({ variables: GetCreditTransactionsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetCreditTransactionsQuery, GetCreditTransactionsQueryVariables>(GetCreditTransactionsDocument, options);
      }
export function useGetCreditTransactionsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetCreditTransactionsQuery, GetCreditTransactionsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetCreditTransactionsQuery, GetCreditTransactionsQueryVariables>(GetCreditTransactionsDocument, options);
        }
// @ts-ignore
export function useGetCreditTransactionsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetCreditTransactionsQuery, GetCreditTransactionsQueryVariables>): Apollo.UseSuspenseQueryResult<GetCreditTransactionsQuery, GetCreditTransactionsQueryVariables>;
export function useGetCreditTransactionsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetCreditTransactionsQuery, GetCreditTransactionsQueryVariables>): Apollo.UseSuspenseQueryResult<GetCreditTransactionsQuery | undefined, GetCreditTransactionsQueryVariables>;
export function useGetCreditTransactionsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetCreditTransactionsQuery, GetCreditTransactionsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetCreditTransactionsQuery, GetCreditTransactionsQueryVariables>(GetCreditTransactionsDocument, options);
        }
export type GetCreditTransactionsQueryHookResult = ReturnType<typeof useGetCreditTransactionsQuery>;
export type GetCreditTransactionsLazyQueryHookResult = ReturnType<typeof useGetCreditTransactionsLazyQuery>;
export type GetCreditTransactionsSuspenseQueryHookResult = ReturnType<typeof useGetCreditTransactionsSuspenseQuery>;
export type GetCreditTransactionsQueryResult = Apollo.QueryResult<GetCreditTransactionsQuery, GetCreditTransactionsQueryVariables>;
export const GetSubscriptionInfoDocument = gql`
    query GetSubscriptionInfo($ownerID: String!) {
  subscriptionInfo(ownerID: $ownerID) {
    planName
    monthlyDeposit
    status
    currentPeriodEnd
    features
  }
}
    `;

/**
 * __useGetSubscriptionInfoQuery__
 *
 * To run a query within a React component, call `useGetSubscriptionInfoQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetSubscriptionInfoQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetSubscriptionInfoQuery({
 *   variables: {
 *      ownerID: // value for 'ownerID'
 *   },
 * });
 */
export function useGetSubscriptionInfoQuery(baseOptions: Apollo.QueryHookOptions<GetSubscriptionInfoQuery, GetSubscriptionInfoQueryVariables> & ({ variables: GetSubscriptionInfoQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetSubscriptionInfoQuery, GetSubscriptionInfoQueryVariables>(GetSubscriptionInfoDocument, options);
      }
export function useGetSubscriptionInfoLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetSubscriptionInfoQuery, GetSubscriptionInfoQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetSubscriptionInfoQuery, GetSubscriptionInfoQueryVariables>(GetSubscriptionInfoDocument, options);
        }
// @ts-ignore
export function useGetSubscriptionInfoSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetSubscriptionInfoQuery, GetSubscriptionInfoQueryVariables>): Apollo.UseSuspenseQueryResult<GetSubscriptionInfoQuery, GetSubscriptionInfoQueryVariables>;
export function useGetSubscriptionInfoSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetSubscriptionInfoQuery, GetSubscriptionInfoQueryVariables>): Apollo.UseSuspenseQueryResult<GetSubscriptionInfoQuery | undefined, GetSubscriptionInfoQueryVariables>;
export function useGetSubscriptionInfoSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetSubscriptionInfoQuery, GetSubscriptionInfoQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetSubscriptionInfoQuery, GetSubscriptionInfoQueryVariables>(GetSubscriptionInfoDocument, options);
        }
export type GetSubscriptionInfoQueryHookResult = ReturnType<typeof useGetSubscriptionInfoQuery>;
export type GetSubscriptionInfoLazyQueryHookResult = ReturnType<typeof useGetSubscriptionInfoLazyQuery>;
export type GetSubscriptionInfoSuspenseQueryHookResult = ReturnType<typeof useGetSubscriptionInfoSuspenseQuery>;
export type GetSubscriptionInfoQueryResult = Apollo.QueryResult<GetSubscriptionInfoQuery, GetSubscriptionInfoQueryVariables>;
export const GetAvailablePlansDocument = gql`
    query GetAvailablePlans {
  availablePlans {
    priceId
    productId
    displayName
    description
    priceAmount
    monthlyDeposit
    features
    displayOrder
  }
}
    `;

/**
 * __useGetAvailablePlansQuery__
 *
 * To run a query within a React component, call `useGetAvailablePlansQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAvailablePlansQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAvailablePlansQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetAvailablePlansQuery(baseOptions?: Apollo.QueryHookOptions<GetAvailablePlansQuery, GetAvailablePlansQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAvailablePlansQuery, GetAvailablePlansQueryVariables>(GetAvailablePlansDocument, options);
      }
export function useGetAvailablePlansLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAvailablePlansQuery, GetAvailablePlansQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAvailablePlansQuery, GetAvailablePlansQueryVariables>(GetAvailablePlansDocument, options);
        }
// @ts-ignore
export function useGetAvailablePlansSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetAvailablePlansQuery, GetAvailablePlansQueryVariables>): Apollo.UseSuspenseQueryResult<GetAvailablePlansQuery, GetAvailablePlansQueryVariables>;
export function useGetAvailablePlansSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetAvailablePlansQuery, GetAvailablePlansQueryVariables>): Apollo.UseSuspenseQueryResult<GetAvailablePlansQuery | undefined, GetAvailablePlansQueryVariables>;
export function useGetAvailablePlansSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetAvailablePlansQuery, GetAvailablePlansQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetAvailablePlansQuery, GetAvailablePlansQueryVariables>(GetAvailablePlansDocument, options);
        }
export type GetAvailablePlansQueryHookResult = ReturnType<typeof useGetAvailablePlansQuery>;
export type GetAvailablePlansLazyQueryHookResult = ReturnType<typeof useGetAvailablePlansLazyQuery>;
export type GetAvailablePlansSuspenseQueryHookResult = ReturnType<typeof useGetAvailablePlansSuspenseQuery>;
export type GetAvailablePlansQueryResult = Apollo.QueryResult<GetAvailablePlansQuery, GetAvailablePlansQueryVariables>;
export const CreateDepositSessionDocument = gql`
    mutation CreateDepositSession($ownerID: String!, $amount: Float!) {
  createDepositSession(ownerID: $ownerID, amount: $amount)
}
    `;
export type CreateDepositSessionMutationFn = Apollo.MutationFunction<CreateDepositSessionMutation, CreateDepositSessionMutationVariables>;

/**
 * __useCreateDepositSessionMutation__
 *
 * To run a mutation, you first call `useCreateDepositSessionMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateDepositSessionMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createDepositSessionMutation, { data, loading, error }] = useCreateDepositSessionMutation({
 *   variables: {
 *      ownerID: // value for 'ownerID'
 *      amount: // value for 'amount'
 *   },
 * });
 */
export function useCreateDepositSessionMutation(baseOptions?: Apollo.MutationHookOptions<CreateDepositSessionMutation, CreateDepositSessionMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateDepositSessionMutation, CreateDepositSessionMutationVariables>(CreateDepositSessionDocument, options);
      }
export type CreateDepositSessionMutationHookResult = ReturnType<typeof useCreateDepositSessionMutation>;
export type CreateDepositSessionMutationResult = Apollo.MutationResult<CreateDepositSessionMutation>;
export type CreateDepositSessionMutationOptions = Apollo.BaseMutationOptions<CreateDepositSessionMutation, CreateDepositSessionMutationVariables>;
export const CreateSubscriptionSessionDocument = gql`
    mutation CreateSubscriptionSession($ownerID: String!, $priceID: String!) {
  createSubscriptionSession(ownerID: $ownerID, priceID: $priceID)
}
    `;
export type CreateSubscriptionSessionMutationFn = Apollo.MutationFunction<CreateSubscriptionSessionMutation, CreateSubscriptionSessionMutationVariables>;

/**
 * __useCreateSubscriptionSessionMutation__
 *
 * To run a mutation, you first call `useCreateSubscriptionSessionMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateSubscriptionSessionMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createSubscriptionSessionMutation, { data, loading, error }] = useCreateSubscriptionSessionMutation({
 *   variables: {
 *      ownerID: // value for 'ownerID'
 *      priceID: // value for 'priceID'
 *   },
 * });
 */
export function useCreateSubscriptionSessionMutation(baseOptions?: Apollo.MutationHookOptions<CreateSubscriptionSessionMutation, CreateSubscriptionSessionMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateSubscriptionSessionMutation, CreateSubscriptionSessionMutationVariables>(CreateSubscriptionSessionDocument, options);
      }
export type CreateSubscriptionSessionMutationHookResult = ReturnType<typeof useCreateSubscriptionSessionMutation>;
export type CreateSubscriptionSessionMutationResult = Apollo.MutationResult<CreateSubscriptionSessionMutation>;
export type CreateSubscriptionSessionMutationOptions = Apollo.BaseMutationOptions<CreateSubscriptionSessionMutation, CreateSubscriptionSessionMutationVariables>;
export const ChangeSubscriptionPlanDocument = gql`
    mutation ChangeSubscriptionPlan($ownerID: String!, $newPriceID: String!) {
  changeSubscriptionPlan(ownerID: $ownerID, newPriceID: $newPriceID) {
    planName
    monthlyDeposit
    status
    currentPeriodEnd
    features
  }
}
    `;
export type ChangeSubscriptionPlanMutationFn = Apollo.MutationFunction<ChangeSubscriptionPlanMutation, ChangeSubscriptionPlanMutationVariables>;

/**
 * __useChangeSubscriptionPlanMutation__
 *
 * To run a mutation, you first call `useChangeSubscriptionPlanMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useChangeSubscriptionPlanMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [changeSubscriptionPlanMutation, { data, loading, error }] = useChangeSubscriptionPlanMutation({
 *   variables: {
 *      ownerID: // value for 'ownerID'
 *      newPriceID: // value for 'newPriceID'
 *   },
 * });
 */
export function useChangeSubscriptionPlanMutation(baseOptions?: Apollo.MutationHookOptions<ChangeSubscriptionPlanMutation, ChangeSubscriptionPlanMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ChangeSubscriptionPlanMutation, ChangeSubscriptionPlanMutationVariables>(ChangeSubscriptionPlanDocument, options);
      }
export type ChangeSubscriptionPlanMutationHookResult = ReturnType<typeof useChangeSubscriptionPlanMutation>;
export type ChangeSubscriptionPlanMutationResult = Apollo.MutationResult<ChangeSubscriptionPlanMutation>;
export type ChangeSubscriptionPlanMutationOptions = Apollo.BaseMutationOptions<ChangeSubscriptionPlanMutation, ChangeSubscriptionPlanMutationVariables>;
export const CancelSubscriptionDocument = gql`
    mutation CancelSubscription($ownerID: String!) {
  cancelSubscription(ownerID: $ownerID) {
    planName
    monthlyDeposit
    status
    currentPeriodEnd
    features
  }
}
    `;
export type CancelSubscriptionMutationFn = Apollo.MutationFunction<CancelSubscriptionMutation, CancelSubscriptionMutationVariables>;

/**
 * __useCancelSubscriptionMutation__
 *
 * To run a mutation, you first call `useCancelSubscriptionMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCancelSubscriptionMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [cancelSubscriptionMutation, { data, loading, error }] = useCancelSubscriptionMutation({
 *   variables: {
 *      ownerID: // value for 'ownerID'
 *   },
 * });
 */
export function useCancelSubscriptionMutation(baseOptions?: Apollo.MutationHookOptions<CancelSubscriptionMutation, CancelSubscriptionMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CancelSubscriptionMutation, CancelSubscriptionMutationVariables>(CancelSubscriptionDocument, options);
      }
export type CancelSubscriptionMutationHookResult = ReturnType<typeof useCancelSubscriptionMutation>;
export type CancelSubscriptionMutationResult = Apollo.MutationResult<CancelSubscriptionMutation>;
export type CancelSubscriptionMutationOptions = Apollo.BaseMutationOptions<CancelSubscriptionMutation, CancelSubscriptionMutationVariables>;
export const GetPaymentHistoryDocument = gql`
    query GetPaymentHistory($ownerID: String!, $limit: Int) {
  paymentHistory(ownerID: $ownerID, limit: $limit) {
    id
    number
    amountPaid
    status
    created
    hostedInvoiceUrl
    invoicePdf
    billingReason
    periodStart
    periodEnd
  }
}
    `;

/**
 * __useGetPaymentHistoryQuery__
 *
 * To run a query within a React component, call `useGetPaymentHistoryQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetPaymentHistoryQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetPaymentHistoryQuery({
 *   variables: {
 *      ownerID: // value for 'ownerID'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useGetPaymentHistoryQuery(baseOptions: Apollo.QueryHookOptions<GetPaymentHistoryQuery, GetPaymentHistoryQueryVariables> & ({ variables: GetPaymentHistoryQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetPaymentHistoryQuery, GetPaymentHistoryQueryVariables>(GetPaymentHistoryDocument, options);
      }
export function useGetPaymentHistoryLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetPaymentHistoryQuery, GetPaymentHistoryQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetPaymentHistoryQuery, GetPaymentHistoryQueryVariables>(GetPaymentHistoryDocument, options);
        }
// @ts-ignore
export function useGetPaymentHistorySuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetPaymentHistoryQuery, GetPaymentHistoryQueryVariables>): Apollo.UseSuspenseQueryResult<GetPaymentHistoryQuery, GetPaymentHistoryQueryVariables>;
export function useGetPaymentHistorySuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetPaymentHistoryQuery, GetPaymentHistoryQueryVariables>): Apollo.UseSuspenseQueryResult<GetPaymentHistoryQuery | undefined, GetPaymentHistoryQueryVariables>;
export function useGetPaymentHistorySuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetPaymentHistoryQuery, GetPaymentHistoryQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetPaymentHistoryQuery, GetPaymentHistoryQueryVariables>(GetPaymentHistoryDocument, options);
        }
export type GetPaymentHistoryQueryHookResult = ReturnType<typeof useGetPaymentHistoryQuery>;
export type GetPaymentHistoryLazyQueryHookResult = ReturnType<typeof useGetPaymentHistoryLazyQuery>;
export type GetPaymentHistorySuspenseQueryHookResult = ReturnType<typeof useGetPaymentHistorySuspenseQuery>;
export type GetPaymentHistoryQueryResult = Apollo.QueryResult<GetPaymentHistoryQuery, GetPaymentHistoryQueryVariables>;