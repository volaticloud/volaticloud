import { ApolloClient, InMemoryCache, HttpLink, ApolloLink, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient, Client } from 'graphql-ws';

// Store the WebSocket client for status monitoring
let wsClient: Client | null = null;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface ConnectionStatusListener {
  (status: ConnectionStatus, error?: Error): void;
}

// Connection status listeners
const statusListeners: Set<ConnectionStatusListener> = new Set();

export const addConnectionStatusListener = (listener: ConnectionStatusListener) => {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
};

const notifyListeners = (status: ConnectionStatus, error?: Error) => {
  statusListeners.forEach(listener => listener(status, error));
};

export const createApolloClient = (
  graphqlUrl: string,
  wsUrl: string,
  getAccessToken?: () => string | undefined
) => {
  const httpLink = new HttpLink({
    uri: graphqlUrl,
  });

  // Create auth link that adds token to headers
  const authLink = setContext((_, { headers }) => {
    const token = getAccessToken?.();
    return {
      headers: {
        ...headers,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    };
  });

  // Create WebSocket client for subscriptions
  wsClient = createClient({
    url: wsUrl,
    connectionParams: () => {
      const token = getAccessToken?.();
      return {
        authToken: token ? `Bearer ${token}` : undefined,
      };
    },
    keepAlive: 15_000, // Send ping every 15 seconds
    retryAttempts: 5,
    shouldRetry: () => true,
    on: {
      connecting: () => {
        notifyListeners('connecting');
      },
      connected: () => {
        notifyListeners('connected');
      },
      closed: () => {
        notifyListeners('disconnected');
      },
      error: (error) => {
        notifyListeners('error', error instanceof Error ? error : new Error(String(error)));
      },
    },
  });

  const wsLink = new GraphQLWsLink(wsClient);

  // Split link: subscriptions via WebSocket, queries/mutations via HTTP
  const splitLink = split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return (
        definition.kind === 'OperationDefinition' &&
        definition.operation === 'subscription'
      );
    },
    wsLink,
    ApolloLink.from([authLink, httpLink])
  );

  return new ApolloClient({
    link: splitLink,
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            // Strategies use relay-style pagination
            strategies: {
              keyArgs: ['where', 'orderBy'],
              merge(_existing, incoming) {
                return incoming;
              },
            },
            // Bots use relay-style pagination
            bots: {
              keyArgs: ['where', 'orderBy'],
              merge(_existing, incoming) {
                return incoming;
              },
            },
            // Backtests use relay-style pagination
            backtests: {
              keyArgs: ['where', 'orderBy'],
              merge(_existing, incoming) {
                return incoming;
              },
            },
          },
        },
      },
    }),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-and-network',
        errorPolicy: 'all',
      },
      query: {
        fetchPolicy: 'cache-first',
        errorPolicy: 'all',
      },
      mutate: {
        errorPolicy: 'all',
      },
    },
  });
};

// Manual reconnect function
export const reconnectWebSocket = () => {
  if (wsClient) {
    // The graphql-ws client will automatically reconnect on next subscription
    // We can force it by terminating and letting it retry
    wsClient.terminate();
  }
};

// Close WebSocket connection
export const closeWebSocket = () => {
  if (wsClient) {
    wsClient.dispose();
    wsClient = null;
  }
};
