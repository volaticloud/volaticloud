export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  Cursor: { input: string; output: string; }
  Time: { input: string; output: string; }
};

export type Backtest = Node & {
  __typename?: 'Backtest';
  /** Completion timestamp */
  completedAt?: Maybe<Scalars['Time']['output']>;
  createdAt: Scalars['Time']['output'];
  id: Scalars['ID']['output'];
  /** Task status */
  status: BacktestTaskStatus;
  strategy: Strategy;
  /** Foreign key to strategy */
  strategyID: Scalars['ID']['output'];
  updatedAt: Scalars['Time']['output'];
};

/** A connection to a list of items. */
export type BacktestConnection = {
  __typename?: 'BacktestConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<BacktestEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** Identifies the total count of items in the connection. */
  totalCount: Scalars['Int']['output'];
};

/** An edge in a connection. */
export type BacktestEdge = {
  __typename?: 'BacktestEdge';
  /** A cursor for use in pagination. */
  cursor: Scalars['Cursor']['output'];
  /** The item at the end of the edge. */
  node?: Maybe<Backtest>;
};

/** BacktestTaskStatus is enum for the field status */
export enum BacktestTaskStatus {
  Completed = 'completed',
  Failed = 'failed',
  Pending = 'pending',
  Running = 'running'
}

export type Bot = Node & {
  __typename?: 'Bot';
  /** Freqtrade API endpoint */
  apiURL?: Maybe<Scalars['String']['output']>;
  /** Freqtrade API username */
  apiUsername?: Maybe<Scalars['String']['output']>;
  /** Runtime-specific identifier (container ID, pod name, etc.) */
  containerID?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['Time']['output'];
  /** Last error message if status is error */
  errorMessage?: Maybe<Scalars['String']['output']>;
  exchange: Exchange;
  /** Foreign key to exchange */
  exchangeID: Scalars['ID']['output'];
  /** Freqtrade version */
  freqtradeVersion: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  /** Last successful health check */
  lastSeenAt?: Maybe<Scalars['Time']['output']>;
  /** Trading mode (dry-run or live) */
  mode: BotBotMode;
  /** Bot display name */
  name: Scalars['String']['output'];
  runtime: BotRuntime;
  /** Foreign key to runtime */
  runtimeID: Scalars['ID']['output'];
  /** Bot lifecycle status */
  status: BotBotStatus;
  strategy: Strategy;
  /** Foreign key to strategy */
  strategyID: Scalars['ID']['output'];
  trades: TradeConnection;
  updatedAt: Scalars['Time']['output'];
};


export type BotTradesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

/** BotBotMode is enum for the field mode */
export enum BotBotMode {
  DryRun = 'dry_run',
  Live = 'live'
}

/** BotBotStatus is enum for the field status */
export enum BotBotStatus {
  Backtesting = 'backtesting',
  Creating = 'creating',
  Error = 'error',
  Hyperopt = 'hyperopt',
  Running = 'running',
  Stopped = 'stopped'
}

/** A connection to a list of items. */
export type BotConnection = {
  __typename?: 'BotConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<BotEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** Identifies the total count of items in the connection. */
  totalCount: Scalars['Int']['output'];
};

/** An edge in a connection. */
export type BotEdge = {
  __typename?: 'BotEdge';
  /** A cursor for use in pagination. */
  cursor: Scalars['Cursor']['output'];
  /** The item at the end of the edge. */
  node?: Maybe<Bot>;
};

export type BotRuntime = Node & {
  __typename?: 'BotRuntime';
  bots: BotConnection;
  createdAt: Scalars['Time']['output'];
  id: Scalars['ID']['output'];
  /** Runtime display name */
  name: Scalars['String']['output'];
  /** Runtime environment type (docker, kubernetes, local) */
  type: BotRuntimeRuntimeType;
  updatedAt: Scalars['Time']['output'];
};


export type BotRuntimeBotsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

/** A connection to a list of items. */
export type BotRuntimeConnection = {
  __typename?: 'BotRuntimeConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<BotRuntimeEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** Identifies the total count of items in the connection. */
  totalCount: Scalars['Int']['output'];
};

/** An edge in a connection. */
export type BotRuntimeEdge = {
  __typename?: 'BotRuntimeEdge';
  /** A cursor for use in pagination. */
  cursor: Scalars['Cursor']['output'];
  /** The item at the end of the edge. */
  node?: Maybe<BotRuntime>;
};

/** BotRuntimeRuntimeType is enum for the field type */
export enum BotRuntimeRuntimeType {
  Docker = 'docker',
  Kubernetes = 'kubernetes',
  Local = 'local'
}

export type BotStatus = {
  __typename?: 'BotStatus';
  botID: Scalars['String']['output'];
  containerID: Scalars['String']['output'];
  cpuUsage: Scalars['Float']['output'];
  createdAt: Scalars['Time']['output'];
  errorMessage: Scalars['String']['output'];
  healthy: Scalars['Boolean']['output'];
  hostPort: Scalars['Int']['output'];
  ipAddress: Scalars['String']['output'];
  lastSeenAt?: Maybe<Scalars['Time']['output']>;
  memoryUsage: Scalars['Int']['output'];
  startedAt?: Maybe<Scalars['Time']['output']>;
  status: BotBotStatus;
  stoppedAt?: Maybe<Scalars['Time']['output']>;
};

/**
 * CreateBacktestInput is used for create Backtest object.
 * Input was generated by ent.
 */
export type CreateBacktestInput = {
  /** Completion timestamp */
  completedAt?: InputMaybe<Scalars['Time']['input']>;
  createdAt?: InputMaybe<Scalars['Time']['input']>;
  /** Task status */
  status?: InputMaybe<BacktestTaskStatus>;
  strategyID: Scalars['ID']['input'];
  updatedAt?: InputMaybe<Scalars['Time']['input']>;
};

/**
 * CreateBotInput is used for create Bot object.
 * Input was generated by ent.
 */
export type CreateBotInput = {
  /** Freqtrade API password (encrypted) */
  apiPassword?: InputMaybe<Scalars['String']['input']>;
  /** Freqtrade API endpoint */
  apiURL?: InputMaybe<Scalars['String']['input']>;
  /** Freqtrade API username */
  apiUsername?: InputMaybe<Scalars['String']['input']>;
  /** Runtime-specific identifier (container ID, pod name, etc.) */
  containerID?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['Time']['input']>;
  /** Last error message if status is error */
  errorMessage?: InputMaybe<Scalars['String']['input']>;
  exchangeID: Scalars['ID']['input'];
  /** Freqtrade version */
  freqtradeVersion?: InputMaybe<Scalars['String']['input']>;
  /** Last successful health check */
  lastSeenAt?: InputMaybe<Scalars['Time']['input']>;
  /** Trading mode (dry-run or live) */
  mode?: InputMaybe<BotBotMode>;
  /** Bot display name */
  name: Scalars['String']['input'];
  runtimeID: Scalars['ID']['input'];
  /** Bot lifecycle status */
  status?: InputMaybe<BotBotStatus>;
  strategyID: Scalars['ID']['input'];
  tradeIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  updatedAt?: InputMaybe<Scalars['Time']['input']>;
};

/**
 * CreateBotRuntimeInput is used for create BotRuntime object.
 * Input was generated by ent.
 */
export type CreateBotRuntimeInput = {
  botIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  createdAt?: InputMaybe<Scalars['Time']['input']>;
  /** Runtime display name */
  name: Scalars['String']['input'];
  /** Runtime environment type (docker, kubernetes, local) */
  type?: InputMaybe<BotRuntimeRuntimeType>;
  updatedAt?: InputMaybe<Scalars['Time']['input']>;
};

/**
 * CreateExchangeInput is used for create Exchange object.
 * Input was generated by ent.
 */
export type CreateExchangeInput = {
  botIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  createdAt?: InputMaybe<Scalars['Time']['input']>;
  /** Exchange name from ExchangeType enum */
  name: ExchangeExchangeType;
  secretIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Use testnet/sandbox */
  testMode?: InputMaybe<Scalars['Boolean']['input']>;
  updatedAt?: InputMaybe<Scalars['Time']['input']>;
};

/**
 * CreateExchangeSecretInput is used for create ExchangeSecret object.
 * Input was generated by ent.
 */
export type CreateExchangeSecretInput = {
  createdAt?: InputMaybe<Scalars['Time']['input']>;
  exchangeID: Scalars['ID']['input'];
  /** Secret name (api_key, api_secret, password, passphrase, etc.) */
  name: Scalars['String']['input'];
  updatedAt?: InputMaybe<Scalars['Time']['input']>;
  /** Secret value (encrypted at rest) */
  value: Scalars['String']['input'];
};

/**
 * CreateStrategyInput is used for create Strategy object.
 * Input was generated by ent.
 */
export type CreateStrategyInput = {
  backtestIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  botIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Python strategy code */
  code: Scalars['String']['input'];
  createdAt?: InputMaybe<Scalars['Time']['input']>;
  /** Strategy description */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Strategy name */
  name: Scalars['String']['input'];
  updatedAt?: InputMaybe<Scalars['Time']['input']>;
  /** Strategy version */
  version?: InputMaybe<Scalars['String']['input']>;
};

/**
 * CreateTradeInput is used for create Trade object.
 * Input was generated by ent.
 */
export type CreateTradeInput = {
  /** Amount of coins */
  amount: Scalars['Float']['input'];
  botID: Scalars['ID']['input'];
  /** Trade close time */
  closeDate?: InputMaybe<Scalars['Time']['input']>;
  /** Exit price */
  closeRate?: InputMaybe<Scalars['Float']['input']>;
  createdAt?: InputMaybe<Scalars['Time']['input']>;
  /** Original trade ID from freqtrade */
  freqtradeTradeID: Scalars['Int']['input'];
  /** Trade open status */
  isOpen?: InputMaybe<Scalars['Boolean']['input']>;
  /** Trade open time */
  openDate: Scalars['Time']['input'];
  /** Entry price */
  openRate: Scalars['Float']['input'];
  /** Trading pair (BTC/USDT) */
  pair: Scalars['String']['input'];
  /** Absolute profit */
  profitAbs?: InputMaybe<Scalars['Float']['input']>;
  /** Profit percentage (0.05 = 5%) */
  profitRatio?: InputMaybe<Scalars['Float']['input']>;
  /** Reason for selling (roi, stoploss, etc.) */
  sellReason?: InputMaybe<Scalars['String']['input']>;
  /** Stake in base currency */
  stakeAmount: Scalars['Float']['input'];
  /** Strategy used */
  strategyName?: InputMaybe<Scalars['String']['input']>;
  /** Timeframe used */
  timeframe?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['Time']['input']>;
};

export type Exchange = Node & {
  __typename?: 'Exchange';
  bots: BotConnection;
  createdAt: Scalars['Time']['output'];
  id: Scalars['ID']['output'];
  /** Exchange name from ExchangeType enum */
  name: ExchangeExchangeType;
  secrets: ExchangeSecretConnection;
  /** Use testnet/sandbox */
  testMode: Scalars['Boolean']['output'];
  updatedAt: Scalars['Time']['output'];
};


export type ExchangeBotsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type ExchangeSecretsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

/** ExchangeExchangeType is enum for the field name */
export enum ExchangeExchangeType {
  Binance = 'binance',
  Binanceus = 'binanceus',
  Bitfinex = 'bitfinex',
  Bybit = 'bybit',
  Coinbase = 'coinbase',
  Kraken = 'kraken',
  Kucoin = 'kucoin',
  Okx = 'okx'
}

export type ExchangeSecret = Node & {
  __typename?: 'ExchangeSecret';
  createdAt: Scalars['Time']['output'];
  exchange: Exchange;
  /** Foreign key to exchange */
  exchangeID: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  /** Secret name (api_key, api_secret, password, passphrase, etc.) */
  name: Scalars['String']['output'];
  updatedAt: Scalars['Time']['output'];
};

/** A connection to a list of items. */
export type ExchangeSecretConnection = {
  __typename?: 'ExchangeSecretConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<ExchangeSecretEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** Identifies the total count of items in the connection. */
  totalCount: Scalars['Int']['output'];
};

/** An edge in a connection. */
export type ExchangeSecretEdge = {
  __typename?: 'ExchangeSecretEdge';
  /** A cursor for use in pagination. */
  cursor: Scalars['Cursor']['output'];
  /** The item at the end of the edge. */
  node?: Maybe<ExchangeSecret>;
};

export type Mutation = {
  __typename?: 'Mutation';
  createBacktest: Backtest;
  createBot: Bot;
  createBotRuntime: BotRuntime;
  createExchange: Exchange;
  createExchangeSecret: ExchangeSecret;
  createStrategy: Strategy;
  createTrade: Trade;
  deleteBacktest: Scalars['Boolean']['output'];
  deleteBot: Scalars['Boolean']['output'];
  deleteBotRuntime: Scalars['Boolean']['output'];
  deleteExchange: Scalars['Boolean']['output'];
  deleteExchangeSecret: Scalars['Boolean']['output'];
  deleteStrategy: Scalars['Boolean']['output'];
  deleteTrade: Scalars['Boolean']['output'];
  restartBot: Bot;
  startBot: Bot;
  stopBot: Bot;
  updateBacktest: Backtest;
  updateBot: Bot;
  updateBotRuntime: BotRuntime;
  updateExchange: Exchange;
  updateExchangeSecret: ExchangeSecret;
  updateStrategy: Strategy;
  updateTrade: Trade;
};


export type MutationCreateBacktestArgs = {
  input: CreateBacktestInput;
};


export type MutationCreateBotArgs = {
  input: CreateBotInput;
};


export type MutationCreateBotRuntimeArgs = {
  input: CreateBotRuntimeInput;
};


export type MutationCreateExchangeArgs = {
  input: CreateExchangeInput;
};


export type MutationCreateExchangeSecretArgs = {
  input: CreateExchangeSecretInput;
};


export type MutationCreateStrategyArgs = {
  input: CreateStrategyInput;
};


export type MutationCreateTradeArgs = {
  input: CreateTradeInput;
};


export type MutationDeleteBacktestArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteBotArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteBotRuntimeArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteExchangeArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteExchangeSecretArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteStrategyArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTradeArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRestartBotArgs = {
  id: Scalars['ID']['input'];
};


export type MutationStartBotArgs = {
  id: Scalars['ID']['input'];
};


export type MutationStopBotArgs = {
  id: Scalars['ID']['input'];
};


export type MutationUpdateBacktestArgs = {
  id: Scalars['ID']['input'];
  input: UpdateBacktestInput;
};


export type MutationUpdateBotArgs = {
  id: Scalars['ID']['input'];
  input: UpdateBotInput;
};


export type MutationUpdateBotRuntimeArgs = {
  id: Scalars['ID']['input'];
  input: UpdateBotRuntimeInput;
};


export type MutationUpdateExchangeArgs = {
  id: Scalars['ID']['input'];
  input: UpdateExchangeInput;
};


export type MutationUpdateExchangeSecretArgs = {
  id: Scalars['ID']['input'];
  input: UpdateExchangeSecretInput;
};


export type MutationUpdateStrategyArgs = {
  id: Scalars['ID']['input'];
  input: UpdateStrategyInput;
};


export type MutationUpdateTradeArgs = {
  id: Scalars['ID']['input'];
  input: UpdateTradeInput;
};

/**
 * An object with an ID.
 * Follows the [Relay Global Object Identification Specification](https://relay.dev/graphql/objectidentification.htm)
 */
export type Node = {
  /** The id of the object. */
  id: Scalars['ID']['output'];
};

/** Possible directions in which to order a list of items when provided an `orderBy` argument. */
export enum OrderDirection {
  /** Specifies an ascending order for a given `orderBy` argument. */
  Asc = 'ASC',
  /** Specifies a descending order for a given `orderBy` argument. */
  Desc = 'DESC'
}

/**
 * Information about pagination in a connection.
 * https://relay.dev/graphql/connections.htm#sec-undefined.PageInfo
 */
export type PageInfo = {
  __typename?: 'PageInfo';
  /** When paginating forwards, the cursor to continue. */
  endCursor?: Maybe<Scalars['Cursor']['output']>;
  /** When paginating forwards, are there more items? */
  hasNextPage: Scalars['Boolean']['output'];
  /** When paginating backwards, are there more items? */
  hasPreviousPage: Scalars['Boolean']['output'];
  /** When paginating backwards, the cursor to continue. */
  startCursor?: Maybe<Scalars['Cursor']['output']>;
};

export type Query = {
  __typename?: 'Query';
  backtests: BacktestConnection;
  botRuntimes: BotRuntimeConnection;
  bots: BotConnection;
  exchangeSecrets: ExchangeSecretConnection;
  exchanges: Array<Exchange>;
  getBotRuntimeStatus?: Maybe<BotStatus>;
  /** Fetches an object given its ID. */
  node?: Maybe<Node>;
  /** Lookup nodes by a list of IDs. */
  nodes: Array<Maybe<Node>>;
  strategies: StrategyConnection;
  trades: TradeConnection;
};


export type QueryBacktestsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryBotRuntimesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryBotsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryExchangeSecretsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryGetBotRuntimeStatusArgs = {
  id: Scalars['ID']['input'];
};


export type QueryNodeArgs = {
  id: Scalars['ID']['input'];
};


export type QueryNodesArgs = {
  ids: Array<Scalars['ID']['input']>;
};


export type QueryStrategiesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryTradesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type Strategy = Node & {
  __typename?: 'Strategy';
  backtests: BacktestConnection;
  bots: BotConnection;
  /** Python strategy code */
  code: Scalars['String']['output'];
  createdAt: Scalars['Time']['output'];
  /** Strategy description */
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  /** Strategy name */
  name: Scalars['String']['output'];
  updatedAt: Scalars['Time']['output'];
  /** Strategy version */
  version: Scalars['String']['output'];
};


export type StrategyBacktestsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type StrategyBotsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

/** A connection to a list of items. */
export type StrategyConnection = {
  __typename?: 'StrategyConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<StrategyEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** Identifies the total count of items in the connection. */
  totalCount: Scalars['Int']['output'];
};

/** An edge in a connection. */
export type StrategyEdge = {
  __typename?: 'StrategyEdge';
  /** A cursor for use in pagination. */
  cursor: Scalars['Cursor']['output'];
  /** The item at the end of the edge. */
  node?: Maybe<Strategy>;
};

export type Trade = Node & {
  __typename?: 'Trade';
  /** Amount of coins */
  amount: Scalars['Float']['output'];
  bot: Bot;
  /** Foreign key to bot */
  botID: Scalars['ID']['output'];
  /** Trade close time */
  closeDate?: Maybe<Scalars['Time']['output']>;
  /** Exit price */
  closeRate?: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['Time']['output'];
  /** Original trade ID from freqtrade */
  freqtradeTradeID: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  /** Trade open status */
  isOpen: Scalars['Boolean']['output'];
  /** Trade open time */
  openDate: Scalars['Time']['output'];
  /** Entry price */
  openRate: Scalars['Float']['output'];
  /** Trading pair (BTC/USDT) */
  pair: Scalars['String']['output'];
  /** Absolute profit */
  profitAbs: Scalars['Float']['output'];
  /** Profit percentage (0.05 = 5%) */
  profitRatio: Scalars['Float']['output'];
  /** Reason for selling (roi, stoploss, etc.) */
  sellReason?: Maybe<Scalars['String']['output']>;
  /** Stake in base currency */
  stakeAmount: Scalars['Float']['output'];
  /** Strategy used */
  strategyName?: Maybe<Scalars['String']['output']>;
  /** Timeframe used */
  timeframe?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['Time']['output'];
};

/** A connection to a list of items. */
export type TradeConnection = {
  __typename?: 'TradeConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<TradeEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** Identifies the total count of items in the connection. */
  totalCount: Scalars['Int']['output'];
};

/** An edge in a connection. */
export type TradeEdge = {
  __typename?: 'TradeEdge';
  /** A cursor for use in pagination. */
  cursor: Scalars['Cursor']['output'];
  /** The item at the end of the edge. */
  node?: Maybe<Trade>;
};

/**
 * UpdateBacktestInput is used for update Backtest object.
 * Input was generated by ent.
 */
export type UpdateBacktestInput = {
  clearCompletedAt?: InputMaybe<Scalars['Boolean']['input']>;
  /** Completion timestamp */
  completedAt?: InputMaybe<Scalars['Time']['input']>;
  /** Task status */
  status?: InputMaybe<BacktestTaskStatus>;
  strategyID?: InputMaybe<Scalars['ID']['input']>;
  updatedAt?: InputMaybe<Scalars['Time']['input']>;
};

/**
 * UpdateBotInput is used for update Bot object.
 * Input was generated by ent.
 */
export type UpdateBotInput = {
  addTradeIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Freqtrade API password (encrypted) */
  apiPassword?: InputMaybe<Scalars['String']['input']>;
  /** Freqtrade API endpoint */
  apiURL?: InputMaybe<Scalars['String']['input']>;
  /** Freqtrade API username */
  apiUsername?: InputMaybe<Scalars['String']['input']>;
  clearAPIPassword?: InputMaybe<Scalars['Boolean']['input']>;
  clearAPIURL?: InputMaybe<Scalars['Boolean']['input']>;
  clearAPIUsername?: InputMaybe<Scalars['Boolean']['input']>;
  clearContainerID?: InputMaybe<Scalars['Boolean']['input']>;
  clearErrorMessage?: InputMaybe<Scalars['Boolean']['input']>;
  clearLastSeenAt?: InputMaybe<Scalars['Boolean']['input']>;
  clearTrades?: InputMaybe<Scalars['Boolean']['input']>;
  /** Runtime-specific identifier (container ID, pod name, etc.) */
  containerID?: InputMaybe<Scalars['String']['input']>;
  /** Last error message if status is error */
  errorMessage?: InputMaybe<Scalars['String']['input']>;
  exchangeID?: InputMaybe<Scalars['ID']['input']>;
  /** Freqtrade version */
  freqtradeVersion?: InputMaybe<Scalars['String']['input']>;
  /** Last successful health check */
  lastSeenAt?: InputMaybe<Scalars['Time']['input']>;
  /** Trading mode (dry-run or live) */
  mode?: InputMaybe<BotBotMode>;
  /** Bot display name */
  name?: InputMaybe<Scalars['String']['input']>;
  removeTradeIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  runtimeID?: InputMaybe<Scalars['ID']['input']>;
  /** Bot lifecycle status */
  status?: InputMaybe<BotBotStatus>;
  strategyID?: InputMaybe<Scalars['ID']['input']>;
  updatedAt?: InputMaybe<Scalars['Time']['input']>;
};

/**
 * UpdateBotRuntimeInput is used for update BotRuntime object.
 * Input was generated by ent.
 */
export type UpdateBotRuntimeInput = {
  addBotIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  clearBots?: InputMaybe<Scalars['Boolean']['input']>;
  /** Runtime display name */
  name?: InputMaybe<Scalars['String']['input']>;
  removeBotIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Runtime environment type (docker, kubernetes, local) */
  type?: InputMaybe<BotRuntimeRuntimeType>;
  updatedAt?: InputMaybe<Scalars['Time']['input']>;
};

/**
 * UpdateExchangeInput is used for update Exchange object.
 * Input was generated by ent.
 */
export type UpdateExchangeInput = {
  addBotIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  addSecretIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  clearBots?: InputMaybe<Scalars['Boolean']['input']>;
  clearSecrets?: InputMaybe<Scalars['Boolean']['input']>;
  /** Exchange name from ExchangeType enum */
  name?: InputMaybe<ExchangeExchangeType>;
  removeBotIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  removeSecretIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Use testnet/sandbox */
  testMode?: InputMaybe<Scalars['Boolean']['input']>;
  updatedAt?: InputMaybe<Scalars['Time']['input']>;
};

/**
 * UpdateExchangeSecretInput is used for update ExchangeSecret object.
 * Input was generated by ent.
 */
export type UpdateExchangeSecretInput = {
  exchangeID?: InputMaybe<Scalars['ID']['input']>;
  /** Secret name (api_key, api_secret, password, passphrase, etc.) */
  name?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['Time']['input']>;
  /** Secret value (encrypted at rest) */
  value?: InputMaybe<Scalars['String']['input']>;
};

/**
 * UpdateStrategyInput is used for update Strategy object.
 * Input was generated by ent.
 */
export type UpdateStrategyInput = {
  addBacktestIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  addBotIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  clearBacktests?: InputMaybe<Scalars['Boolean']['input']>;
  clearBots?: InputMaybe<Scalars['Boolean']['input']>;
  clearDescription?: InputMaybe<Scalars['Boolean']['input']>;
  /** Python strategy code */
  code?: InputMaybe<Scalars['String']['input']>;
  /** Strategy description */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Strategy name */
  name?: InputMaybe<Scalars['String']['input']>;
  removeBacktestIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  removeBotIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  updatedAt?: InputMaybe<Scalars['Time']['input']>;
  /** Strategy version */
  version?: InputMaybe<Scalars['String']['input']>;
};

/**
 * UpdateTradeInput is used for update Trade object.
 * Input was generated by ent.
 */
export type UpdateTradeInput = {
  /** Amount of coins */
  amount?: InputMaybe<Scalars['Float']['input']>;
  botID?: InputMaybe<Scalars['ID']['input']>;
  clearCloseDate?: InputMaybe<Scalars['Boolean']['input']>;
  clearCloseRate?: InputMaybe<Scalars['Boolean']['input']>;
  clearSellReason?: InputMaybe<Scalars['Boolean']['input']>;
  clearStrategyName?: InputMaybe<Scalars['Boolean']['input']>;
  clearTimeframe?: InputMaybe<Scalars['Boolean']['input']>;
  /** Trade close time */
  closeDate?: InputMaybe<Scalars['Time']['input']>;
  /** Exit price */
  closeRate?: InputMaybe<Scalars['Float']['input']>;
  /** Original trade ID from freqtrade */
  freqtradeTradeID?: InputMaybe<Scalars['Int']['input']>;
  /** Trade open status */
  isOpen?: InputMaybe<Scalars['Boolean']['input']>;
  /** Trade open time */
  openDate?: InputMaybe<Scalars['Time']['input']>;
  /** Entry price */
  openRate?: InputMaybe<Scalars['Float']['input']>;
  /** Trading pair (BTC/USDT) */
  pair?: InputMaybe<Scalars['String']['input']>;
  /** Absolute profit */
  profitAbs?: InputMaybe<Scalars['Float']['input']>;
  /** Profit percentage (0.05 = 5%) */
  profitRatio?: InputMaybe<Scalars['Float']['input']>;
  /** Reason for selling (roi, stoploss, etc.) */
  sellReason?: InputMaybe<Scalars['String']['input']>;
  /** Stake in base currency */
  stakeAmount?: InputMaybe<Scalars['Float']['input']>;
  /** Strategy used */
  strategyName?: InputMaybe<Scalars['String']['input']>;
  /** Timeframe used */
  timeframe?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['Time']['input']>;
};
