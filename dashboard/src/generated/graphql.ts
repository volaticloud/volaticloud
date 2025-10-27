import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
const defaultOptions = {} as const;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  Cursor: { input: string; output: string; }
  Map: { input: any; output: any; }
  Time: { input: string; output: string; }
};

export type Backtest = Node & {
  __typename?: 'Backtest';
  /** Completion timestamp */
  completedAt?: Maybe<Scalars['Time']['output']>;
  /** Backtest configuration (pairs, timeframe, dates, stake, etc.) */
  config?: Maybe<Scalars['Map']['output']>;
  /** Docker container ID for running backtest */
  containerID?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['Time']['output'];
  /** Error message if backtest failed */
  errorMessage?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  /** Backtest result data (metrics, logs, trades, etc.) */
  result?: Maybe<Scalars['Map']['output']>;
  runner: BotRunner;
  /** Foreign key to runner */
  runnerID: Scalars['ID']['output'];
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

export type BinanceConfigInput = {
  apiKey: Scalars['String']['input'];
  apiSecret: Scalars['String']['input'];
};

export type BitfinexConfigInput = {
  apiKey: Scalars['String']['input'];
  apiSecret: Scalars['String']['input'];
};

export type Bot = Node & {
  __typename?: 'Bot';
  /** Complete freqtrade bot configuration (stake, pairlists, pricing, api_server, etc.) */
  config?: Maybe<Scalars['Map']['output']>;
  /** Runner-specific identifier (container ID, pod name, etc.) */
  containerID?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['Time']['output'];
  /** Last error message if status is error */
  errorMessage?: Maybe<Scalars['String']['output']>;
  exchange: Exchange;
  /** Foreign key to exchange (provides credentials) */
  exchangeID: Scalars['ID']['output'];
  /** Freqtrade Docker image version tag */
  freqtradeVersion: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  /** Last successful health check */
  lastSeenAt?: Maybe<Scalars['Time']['output']>;
  /** Trading mode (dry-run or live) */
  mode: BotBotMode;
  /** Bot display name */
  name: Scalars['String']['output'];
  runner: BotRunner;
  /** Foreign key to runner (provides execution environment) */
  runnerID: Scalars['ID']['output'];
  /** Bot lifecycle status */
  status: BotBotStatus;
  strategy: Strategy;
  /** Foreign key to strategy (provides code) */
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

export type BotRunner = Node & {
  __typename?: 'BotRunner';
  backtests: BacktestConnection;
  bots: BotConnection;
  createdAt: Scalars['Time']['output'];
  id: Scalars['ID']['output'];
  /** Runner display name */
  name: Scalars['String']['output'];
  /** Runner environment type (docker, kubernetes, local) */
  type: BotRunnerRunnerType;
  updatedAt: Scalars['Time']['output'];
};


export type BotRunnerBacktestsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type BotRunnerBotsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

/** A connection to a list of items. */
export type BotRunnerConnection = {
  __typename?: 'BotRunnerConnection';
  /** A list of edges. */
  edges?: Maybe<Array<Maybe<BotRunnerEdge>>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** Identifies the total count of items in the connection. */
  totalCount: Scalars['Int']['output'];
};

/** An edge in a connection. */
export type BotRunnerEdge = {
  __typename?: 'BotRunnerEdge';
  /** A cursor for use in pagination. */
  cursor: Scalars['Cursor']['output'];
  /** The item at the end of the edge. */
  node?: Maybe<BotRunner>;
};

/** BotRunnerRunnerType is enum for the field type */
export enum BotRunnerRunnerType {
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

export type BybitConfigInput = {
  apiKey: Scalars['String']['input'];
  apiSecret: Scalars['String']['input'];
};

/**
 * CreateBacktestInput is used for create Backtest object.
 * Input was generated by ent.
 */
export type CreateBacktestInput = {
  /** Completion timestamp */
  completedAt?: InputMaybe<Scalars['Time']['input']>;
  /** Backtest configuration (pairs, timeframe, dates, stake, etc.) */
  config?: InputMaybe<Scalars['Map']['input']>;
  /** Docker container ID for running backtest */
  containerID?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['Time']['input']>;
  /** Error message if backtest failed */
  errorMessage?: InputMaybe<Scalars['String']['input']>;
  /** Backtest result data (metrics, logs, trades, etc.) */
  result?: InputMaybe<Scalars['Map']['input']>;
  runnerID: Scalars['ID']['input'];
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
  /** Complete freqtrade bot configuration (stake, pairlists, pricing, api_server, etc.) */
  config?: InputMaybe<Scalars['Map']['input']>;
  /** Runner-specific identifier (container ID, pod name, etc.) */
  containerID?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['Time']['input']>;
  /** Last error message if status is error */
  errorMessage?: InputMaybe<Scalars['String']['input']>;
  exchangeID: Scalars['ID']['input'];
  /** Freqtrade Docker image version tag */
  freqtradeVersion?: InputMaybe<Scalars['String']['input']>;
  /** Last successful health check */
  lastSeenAt?: InputMaybe<Scalars['Time']['input']>;
  /** Trading mode (dry-run or live) */
  mode?: InputMaybe<BotBotMode>;
  /** Bot display name */
  name: Scalars['String']['input'];
  runnerID: Scalars['ID']['input'];
  /** Bot lifecycle status */
  status?: InputMaybe<BotBotStatus>;
  strategyID: Scalars['ID']['input'];
  tradeIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  updatedAt?: InputMaybe<Scalars['Time']['input']>;
};

/**
 * CreateBotRunnerInput is used for create BotRunner object.
 * Input was generated by ent.
 */
export type CreateBotRunnerInput = {
  backtestIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  botIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Runner connection configuration (host, port, credentials, etc.) */
  config?: InputMaybe<RunnerConfigInput>;
  createdAt?: InputMaybe<Scalars['Time']['input']>;
  /** Runner display name */
  name: Scalars['String']['input'];
  /** Runner environment type (docker, kubernetes, local) */
  type?: InputMaybe<BotRunnerRunnerType>;
  updatedAt?: InputMaybe<Scalars['Time']['input']>;
};

/**
 * CreateExchangeInput is used for create Exchange object.
 * Input was generated by ent.
 */
export type CreateExchangeInput = {
  botIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Complete freqtrade exchange configuration (name, key, secret, pair_whitelist, etc.) */
  config?: InputMaybe<Scalars['Map']['input']>;
  createdAt?: InputMaybe<Scalars['Time']['input']>;
  /** Exchange display name (e.g., 'Binance Production', 'Coinbase Testnet') */
  name: Scalars['String']['input'];
  updatedAt?: InputMaybe<Scalars['Time']['input']>;
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
  /** Strategy-specific configuration (config.json) */
  config?: InputMaybe<Scalars['Map']['input']>;
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

export type DockerConfigInput = {
  apiVersion?: InputMaybe<Scalars['String']['input']>;
  caPath?: InputMaybe<Scalars['String']['input']>;
  certPath?: InputMaybe<Scalars['String']['input']>;
  host: Scalars['String']['input'];
  keyPath?: InputMaybe<Scalars['String']['input']>;
  network?: InputMaybe<Scalars['String']['input']>;
  registryAuth?: InputMaybe<RegistryAuthInput>;
  tlsVerify?: InputMaybe<Scalars['Boolean']['input']>;
};

export type Exchange = Node & {
  __typename?: 'Exchange';
  bots: BotConnection;
  /** Complete freqtrade exchange configuration (name, key, secret, pair_whitelist, etc.) */
  config?: Maybe<Scalars['Map']['output']>;
  createdAt: Scalars['Time']['output'];
  id: Scalars['ID']['output'];
  /** Exchange display name (e.g., 'Binance Production', 'Coinbase Testnet') */
  name: Scalars['String']['output'];
  updatedAt: Scalars['Time']['output'];
};


export type ExchangeBotsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type ExchangeConfigInput = {
  binance?: InputMaybe<BinanceConfigInput>;
  binanceus?: InputMaybe<BinanceConfigInput>;
  bitfinex?: InputMaybe<BitfinexConfigInput>;
  bybit?: InputMaybe<BybitConfigInput>;
  coinbase?: InputMaybe<PassphraseExchangeConfigInput>;
  kraken?: InputMaybe<KrakenConfigInput>;
  kucoin?: InputMaybe<PassphraseExchangeConfigInput>;
  okx?: InputMaybe<PassphraseExchangeConfigInput>;
};

export type KrakenConfigInput = {
  apiKey: Scalars['String']['input'];
  apiSecret: Scalars['String']['input'];
};

export type KubernetesConfigInput = {
  context?: InputMaybe<Scalars['String']['input']>;
  kubeconfigPath?: InputMaybe<Scalars['String']['input']>;
  namespace?: InputMaybe<Scalars['String']['input']>;
};

export type LocalConfigInput = {
  basePath?: InputMaybe<Scalars['String']['input']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  createBacktest: Backtest;
  createBot: Bot;
  createBotRunner: BotRunner;
  createExchange: Exchange;
  createStrategy: Strategy;
  createTrade: Trade;
  deleteBacktest: Scalars['Boolean']['output'];
  deleteBot: Scalars['Boolean']['output'];
  deleteBotRunner: Scalars['Boolean']['output'];
  deleteExchange: Scalars['Boolean']['output'];
  deleteStrategy: Scalars['Boolean']['output'];
  deleteTrade: Scalars['Boolean']['output'];
  restartBot: Bot;
  runBacktest: Backtest;
  startBot: Bot;
  stopBacktest: Backtest;
  stopBot: Bot;
  updateBacktest: Backtest;
  updateBot: Bot;
  updateBotRunner: BotRunner;
  updateExchange: Exchange;
  updateStrategy: Strategy;
  updateTrade: Trade;
};


export type MutationCreateBacktestArgs = {
  input: CreateBacktestInput;
};


export type MutationCreateBotArgs = {
  input: CreateBotInput;
};


export type MutationCreateBotRunnerArgs = {
  input: CreateBotRunnerInput;
};


export type MutationCreateExchangeArgs = {
  input: CreateExchangeInput;
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


export type MutationDeleteBotRunnerArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteExchangeArgs = {
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


export type MutationRunBacktestArgs = {
  id: Scalars['ID']['input'];
};


export type MutationStartBotArgs = {
  id: Scalars['ID']['input'];
};


export type MutationStopBacktestArgs = {
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


export type MutationUpdateBotRunnerArgs = {
  id: Scalars['ID']['input'];
  input: UpdateBotRunnerInput;
};


export type MutationUpdateExchangeArgs = {
  id: Scalars['ID']['input'];
  input: UpdateExchangeInput;
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

export type PassphraseExchangeConfigInput = {
  apiKey: Scalars['String']['input'];
  apiSecret: Scalars['String']['input'];
  passphrase: Scalars['String']['input'];
};

export type Query = {
  __typename?: 'Query';
  backtests: BacktestConnection;
  botRunners: BotRunnerConnection;
  bots: BotConnection;
  exchanges: Array<Exchange>;
  getBotRunnerStatus?: Maybe<BotStatus>;
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


export type QueryBotRunnersArgs = {
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


export type QueryGetBotRunnerStatusArgs = {
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

export type RegistryAuthInput = {
  password: Scalars['String']['input'];
  serverAddress?: InputMaybe<Scalars['String']['input']>;
  username: Scalars['String']['input'];
};

export type RunnerConfigInput = {
  docker?: InputMaybe<DockerConfigInput>;
  kubernetes?: InputMaybe<KubernetesConfigInput>;
  local?: InputMaybe<LocalConfigInput>;
};

export type Strategy = Node & {
  __typename?: 'Strategy';
  backtests: BacktestConnection;
  bots: BotConnection;
  /** Python strategy code */
  code: Scalars['String']['output'];
  /** Strategy-specific configuration (config.json) */
  config?: Maybe<Scalars['Map']['output']>;
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
  clearConfig?: InputMaybe<Scalars['Boolean']['input']>;
  clearContainerID?: InputMaybe<Scalars['Boolean']['input']>;
  clearErrorMessage?: InputMaybe<Scalars['Boolean']['input']>;
  clearResult?: InputMaybe<Scalars['Boolean']['input']>;
  /** Completion timestamp */
  completedAt?: InputMaybe<Scalars['Time']['input']>;
  /** Backtest configuration (pairs, timeframe, dates, stake, etc.) */
  config?: InputMaybe<Scalars['Map']['input']>;
  /** Docker container ID for running backtest */
  containerID?: InputMaybe<Scalars['String']['input']>;
  /** Error message if backtest failed */
  errorMessage?: InputMaybe<Scalars['String']['input']>;
  /** Backtest result data (metrics, logs, trades, etc.) */
  result?: InputMaybe<Scalars['Map']['input']>;
  runnerID?: InputMaybe<Scalars['ID']['input']>;
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
  clearConfig?: InputMaybe<Scalars['Boolean']['input']>;
  clearContainerID?: InputMaybe<Scalars['Boolean']['input']>;
  clearErrorMessage?: InputMaybe<Scalars['Boolean']['input']>;
  clearLastSeenAt?: InputMaybe<Scalars['Boolean']['input']>;
  clearTrades?: InputMaybe<Scalars['Boolean']['input']>;
  /** Complete freqtrade bot configuration (stake, pairlists, pricing, api_server, etc.) */
  config?: InputMaybe<Scalars['Map']['input']>;
  /** Runner-specific identifier (container ID, pod name, etc.) */
  containerID?: InputMaybe<Scalars['String']['input']>;
  /** Last error message if status is error */
  errorMessage?: InputMaybe<Scalars['String']['input']>;
  exchangeID?: InputMaybe<Scalars['ID']['input']>;
  /** Freqtrade Docker image version tag */
  freqtradeVersion?: InputMaybe<Scalars['String']['input']>;
  /** Last successful health check */
  lastSeenAt?: InputMaybe<Scalars['Time']['input']>;
  /** Trading mode (dry-run or live) */
  mode?: InputMaybe<BotBotMode>;
  /** Bot display name */
  name?: InputMaybe<Scalars['String']['input']>;
  removeTradeIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  runnerID?: InputMaybe<Scalars['ID']['input']>;
  /** Bot lifecycle status */
  status?: InputMaybe<BotBotStatus>;
  strategyID?: InputMaybe<Scalars['ID']['input']>;
  updatedAt?: InputMaybe<Scalars['Time']['input']>;
};

/**
 * UpdateBotRunnerInput is used for update BotRunner object.
 * Input was generated by ent.
 */
export type UpdateBotRunnerInput = {
  addBacktestIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  addBotIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  clearBacktests?: InputMaybe<Scalars['Boolean']['input']>;
  clearBots?: InputMaybe<Scalars['Boolean']['input']>;
  clearConfig?: InputMaybe<Scalars['Boolean']['input']>;
  /** Runner connection configuration (host, port, credentials, etc.) */
  config?: InputMaybe<RunnerConfigInput>;
  /** Runner display name */
  name?: InputMaybe<Scalars['String']['input']>;
  removeBacktestIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  removeBotIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Runner environment type (docker, kubernetes, local) */
  type?: InputMaybe<BotRunnerRunnerType>;
  updatedAt?: InputMaybe<Scalars['Time']['input']>;
};

/**
 * UpdateExchangeInput is used for update Exchange object.
 * Input was generated by ent.
 */
export type UpdateExchangeInput = {
  addBotIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  clearBots?: InputMaybe<Scalars['Boolean']['input']>;
  clearConfig?: InputMaybe<Scalars['Boolean']['input']>;
  /** Complete freqtrade exchange configuration (name, key, secret, pair_whitelist, etc.) */
  config?: InputMaybe<Scalars['Map']['input']>;
  /** Exchange display name (e.g., 'Binance Production', 'Coinbase Testnet') */
  name?: InputMaybe<Scalars['String']['input']>;
  removeBotIDs?: InputMaybe<Array<Scalars['ID']['input']>>;
  updatedAt?: InputMaybe<Scalars['Time']['input']>;
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
  clearConfig?: InputMaybe<Scalars['Boolean']['input']>;
  clearDescription?: InputMaybe<Scalars['Boolean']['input']>;
  /** Python strategy code */
  code?: InputMaybe<Scalars['String']['input']>;
  /** Strategy-specific configuration (config.json) */
  config?: InputMaybe<Scalars['Map']['input']>;
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

export type GetBacktestsQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['Cursor']['input']>;
}>;


export type GetBacktestsQuery = { __typename?: 'Query', backtests: { __typename?: 'BacktestConnection', totalCount: number, edges?: Array<{ __typename?: 'BacktestEdge', node?: { __typename?: 'Backtest', id: string, status: BacktestTaskStatus, config?: any | null, result?: any | null, containerID?: string | null, errorMessage?: string | null, createdAt: string, updatedAt: string, completedAt?: string | null, strategy: { __typename?: 'Strategy', id: string, name: string }, runner: { __typename?: 'BotRunner', id: string, name: string, type: BotRunnerRunnerType } } | null } | null> | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type GetBacktestQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetBacktestQuery = { __typename?: 'Query', node?:
    | { __typename?: 'Backtest', id: string, status: BacktestTaskStatus, config?: any | null, result?: any | null, containerID?: string | null, errorMessage?: string | null, createdAt: string, updatedAt: string, completedAt?: string | null, strategy: { __typename?: 'Strategy', id: string, name: string, description?: string | null, version: string }, runner: { __typename?: 'BotRunner', id: string, name: string, type: BotRunnerRunnerType } }
    | { __typename?: 'Bot' }
    | { __typename?: 'BotRunner' }
    | { __typename?: 'Exchange' }
    | { __typename?: 'Strategy' }
    | { __typename?: 'Trade' }
   | null };

export type GetBacktestOptionsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetBacktestOptionsQuery = { __typename?: 'Query', strategies: { __typename?: 'StrategyConnection', edges?: Array<{ __typename?: 'StrategyEdge', node?: { __typename?: 'Strategy', id: string, name: string } | null } | null> | null }, botRunners: { __typename?: 'BotRunnerConnection', edges?: Array<{ __typename?: 'BotRunnerEdge', node?: { __typename?: 'BotRunner', id: string, name: string, type: BotRunnerRunnerType } | null } | null> | null } };

export type CreateBacktestMutationVariables = Exact<{
  input: CreateBacktestInput;
}>;


export type CreateBacktestMutation = { __typename?: 'Mutation', createBacktest: { __typename?: 'Backtest', id: string, status: BacktestTaskStatus, config?: any | null, createdAt: string } };

export type UpdateBacktestMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateBacktestInput;
}>;


export type UpdateBacktestMutation = { __typename?: 'Mutation', updateBacktest: { __typename?: 'Backtest', id: string, status: BacktestTaskStatus, config?: any | null } };

export type DeleteBacktestMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteBacktestMutation = { __typename?: 'Mutation', deleteBacktest: boolean };

export type RunBacktestMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type RunBacktestMutation = { __typename?: 'Mutation', runBacktest: { __typename?: 'Backtest', id: string, status: BacktestTaskStatus, containerID?: string | null } };

export type StopBacktestMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type StopBacktestMutation = { __typename?: 'Mutation', stopBacktest: { __typename?: 'Backtest', id: string, status: BacktestTaskStatus } };

export type GetBotsQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['Cursor']['input']>;
}>;


export type GetBotsQuery = { __typename?: 'Query', bots: { __typename?: 'BotConnection', totalCount: number, edges?: Array<{ __typename?: 'BotEdge', node?: { __typename?: 'Bot', id: string, name: string, status: BotBotStatus, mode: BotBotMode, containerID?: string | null, freqtradeVersion: string, lastSeenAt?: string | null, errorMessage?: string | null, createdAt: string, config?: any | null, exchange: { __typename?: 'Exchange', id: string, name: string }, strategy: { __typename?: 'Strategy', id: string, name: string }, runner: { __typename?: 'BotRunner', id: string, name: string, type: BotRunnerRunnerType } } | null } | null> | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type GetBotQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetBotQuery = { __typename?: 'Query', node?:
    | { __typename?: 'Backtest' }
    | { __typename?: 'Bot', id: string, name: string, status: BotBotStatus, mode: BotBotMode, containerID?: string | null, freqtradeVersion: string, lastSeenAt?: string | null, errorMessage?: string | null, createdAt: string, updatedAt: string, config?: any | null, exchange: { __typename?: 'Exchange', id: string, name: string }, strategy: { __typename?: 'Strategy', id: string, name: string, description?: string | null, version: string }, runner: { __typename?: 'BotRunner', id: string, name: string, type: BotRunnerRunnerType }, trades: { __typename?: 'TradeConnection', totalCount: number, edges?: Array<{ __typename?: 'TradeEdge', node?: { __typename?: 'Trade', id: string, pair: string, isOpen: boolean, openDate: string, closeDate?: string | null, profitAbs: number, profitRatio: number } | null } | null> | null } }
    | { __typename?: 'BotRunner' }
    | { __typename?: 'Exchange' }
    | { __typename?: 'Strategy' }
    | { __typename?: 'Trade' }
   | null };

export type GetBotRunnerStatusQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetBotRunnerStatusQuery = { __typename?: 'Query', getBotRunnerStatus?: { __typename?: 'BotStatus', botID: string, status: BotBotStatus, containerID: string, healthy: boolean, lastSeenAt?: string | null, cpuUsage: number, memoryUsage: number, ipAddress: string, hostPort: number, errorMessage: string, createdAt: string, startedAt?: string | null, stoppedAt?: string | null } | null };

export type CreateBotMutationVariables = Exact<{
  input: CreateBotInput;
}>;


export type CreateBotMutation = { __typename?: 'Mutation', createBot: { __typename?: 'Bot', id: string, name: string, status: BotBotStatus, mode: BotBotMode, freqtradeVersion: string, config?: any | null } };

export type UpdateBotMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateBotInput;
}>;


export type UpdateBotMutation = { __typename?: 'Mutation', updateBot: { __typename?: 'Bot', id: string, name: string, status: BotBotStatus, mode: BotBotMode, config?: any | null } };

export type DeleteBotMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteBotMutation = { __typename?: 'Mutation', deleteBot: boolean };

export type StartBotMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type StartBotMutation = { __typename?: 'Mutation', startBot: { __typename?: 'Bot', id: string, name: string, status: BotBotStatus } };

export type StopBotMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type StopBotMutation = { __typename?: 'Mutation', stopBot: { __typename?: 'Bot', id: string, name: string, status: BotBotStatus } };

export type RestartBotMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type RestartBotMutation = { __typename?: 'Mutation', restartBot: { __typename?: 'Bot', id: string, name: string, status: BotBotStatus } };

export type GetDashboardDataQueryVariables = Exact<{ [key: string]: never; }>;


export type GetDashboardDataQuery = { __typename?: 'Query', bots: { __typename?: 'BotConnection', totalCount: number, edges?: Array<{ __typename?: 'BotEdge', node?: { __typename?: 'Bot', id: string, name: string, status: BotBotStatus, mode: BotBotMode, freqtradeVersion: string, lastSeenAt?: string | null, exchange: { __typename?: 'Exchange', id: string, name: string }, strategy: { __typename?: 'Strategy', id: string, name: string } } | null } | null> | null }, trades: { __typename?: 'TradeConnection', totalCount: number, edges?: Array<{ __typename?: 'TradeEdge', node?: { __typename?: 'Trade', id: string, pair: string, isOpen: boolean, openDate: string, closeDate?: string | null, profitAbs: number, profitRatio: number, bot: { __typename?: 'Bot', id: string, name: string } } | null } | null> | null }, exchanges: Array<{ __typename?: 'Exchange', id: string, name: string }>, strategies: { __typename?: 'StrategyConnection', totalCount: number, edges?: Array<{ __typename?: 'StrategyEdge', node?: { __typename?: 'Strategy', id: string, name: string, version: string } | null } | null> | null } };

export type GetExchangesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetExchangesQuery = { __typename?: 'Query', exchanges: Array<{ __typename?: 'Exchange', id: string, name: string, config?: any | null, createdAt: string, updatedAt: string, bots: { __typename?: 'BotConnection', totalCount: number } }> };

export type GetExchangeQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetExchangeQuery = { __typename?: 'Query', node?:
    | { __typename?: 'Backtest' }
    | { __typename?: 'Bot' }
    | { __typename?: 'BotRunner' }
    | { __typename?: 'Exchange', id: string, name: string, config?: any | null, createdAt: string, updatedAt: string, bots: { __typename?: 'BotConnection', totalCount: number, edges?: Array<{ __typename?: 'BotEdge', node?: { __typename?: 'Bot', id: string, name: string, status: BotBotStatus } | null } | null> | null } }
    | { __typename?: 'Strategy' }
    | { __typename?: 'Trade' }
   | null };

export type CreateExchangeMutationVariables = Exact<{
  input: CreateExchangeInput;
}>;


export type CreateExchangeMutation = { __typename?: 'Mutation', createExchange: { __typename?: 'Exchange', id: string, name: string, config?: any | null } };

export type UpdateExchangeMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateExchangeInput;
}>;


export type UpdateExchangeMutation = { __typename?: 'Mutation', updateExchange: { __typename?: 'Exchange', id: string, name: string, config?: any | null } };

export type DeleteExchangeMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteExchangeMutation = { __typename?: 'Mutation', deleteExchange: boolean };

export type GetBotsCountQueryVariables = Exact<{ [key: string]: never; }>;


export type GetBotsCountQuery = { __typename?: 'Query', bots: { __typename?: 'BotConnection', totalCount: number } };

export type GetExchangesForLayoutQueryVariables = Exact<{ [key: string]: never; }>;


export type GetExchangesForLayoutQuery = { __typename?: 'Query', exchanges: Array<{ __typename?: 'Exchange', id: string, name: string }> };

export type GetRunnersQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['Cursor']['input']>;
}>;


export type GetRunnersQuery = { __typename?: 'Query', botRunners: { __typename?: 'BotRunnerConnection', totalCount: number, edges?: Array<{ __typename?: 'BotRunnerEdge', node?: { __typename?: 'BotRunner', id: string, name: string, type: BotRunnerRunnerType, createdAt: string, bots: { __typename?: 'BotConnection', totalCount: number } } | null } | null> | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type GetRunnerQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetRunnerQuery = { __typename?: 'Query', node?:
    | { __typename?: 'Backtest' }
    | { __typename?: 'Bot' }
    | { __typename?: 'BotRunner', id: string, name: string, type: BotRunnerRunnerType, createdAt: string, bots: { __typename?: 'BotConnection', totalCount: number } }
    | { __typename?: 'Exchange' }
    | { __typename?: 'Strategy' }
    | { __typename?: 'Trade' }
   | null };

export type CreateRunnerMutationVariables = Exact<{
  input: CreateBotRunnerInput;
}>;


export type CreateRunnerMutation = { __typename?: 'Mutation', createBotRunner: { __typename?: 'BotRunner', id: string, name: string, type: BotRunnerRunnerType } };

export type UpdateRunnerMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateBotRunnerInput;
}>;


export type UpdateRunnerMutation = { __typename?: 'Mutation', updateBotRunner: { __typename?: 'BotRunner', id: string, name: string, type: BotRunnerRunnerType } };

export type DeleteRunnerMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteRunnerMutation = { __typename?: 'Mutation', deleteBotRunner: boolean };

export type GetStrategiesQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['Cursor']['input']>;
}>;


export type GetStrategiesQuery = { __typename?: 'Query', strategies: { __typename?: 'StrategyConnection', totalCount: number, edges?: Array<{ __typename?: 'StrategyEdge', node?: { __typename?: 'Strategy', id: string, name: string, description?: string | null, code: string, version: string, config?: any | null, createdAt: string, bots: { __typename?: 'BotConnection', totalCount: number } } | null } | null> | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null, endCursor?: string | null } } };

export type CreateStrategyMutationVariables = Exact<{
  input: CreateStrategyInput;
}>;


export type CreateStrategyMutation = { __typename?: 'Mutation', createStrategy: { __typename?: 'Strategy', id: string, name: string, description?: string | null, code: string, version: string, config?: any | null } };

export type UpdateStrategyMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateStrategyInput;
}>;


export type UpdateStrategyMutation = { __typename?: 'Mutation', updateStrategy: { __typename?: 'Strategy', id: string, name: string, description?: string | null, code: string, version: string, config?: any | null } };

export type DeleteStrategyMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteStrategyMutation = { __typename?: 'Mutation', deleteStrategy: boolean };


export const GetBacktestsDocument = gql`
    query GetBacktests($first: Int, $after: Cursor) {
  backtests(first: $first, after: $after) {
    edges {
      node {
        id
        status
        config
        result
        containerID
        errorMessage
        createdAt
        updatedAt
        completedAt
        strategy {
          id
          name
        }
        runner {
          id
          name
          type
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
 * __useGetBacktestsQuery__
 *
 * To run a query within a React component, call `useGetBacktestsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetBacktestsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetBacktestsQuery({
 *   variables: {
 *      first: // value for 'first'
 *      after: // value for 'after'
 *   },
 * });
 */
export function useGetBacktestsQuery(baseOptions?: Apollo.QueryHookOptions<GetBacktestsQuery, GetBacktestsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetBacktestsQuery, GetBacktestsQueryVariables>(GetBacktestsDocument, options);
      }
export function useGetBacktestsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetBacktestsQuery, GetBacktestsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetBacktestsQuery, GetBacktestsQueryVariables>(GetBacktestsDocument, options);
        }
export function useGetBacktestsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetBacktestsQuery, GetBacktestsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetBacktestsQuery, GetBacktestsQueryVariables>(GetBacktestsDocument, options);
        }
export type GetBacktestsQueryHookResult = ReturnType<typeof useGetBacktestsQuery>;
export type GetBacktestsLazyQueryHookResult = ReturnType<typeof useGetBacktestsLazyQuery>;
export type GetBacktestsSuspenseQueryHookResult = ReturnType<typeof useGetBacktestsSuspenseQuery>;
export type GetBacktestsQueryResult = Apollo.QueryResult<GetBacktestsQuery, GetBacktestsQueryVariables>;
export const GetBacktestDocument = gql`
    query GetBacktest($id: ID!) {
  node(id: $id) {
    ... on Backtest {
      id
      status
      config
      result
      containerID
      errorMessage
      createdAt
      updatedAt
      completedAt
      strategy {
        id
        name
        description
        version
      }
      runner {
        id
        name
        type
      }
    }
  }
}
    `;

/**
 * __useGetBacktestQuery__
 *
 * To run a query within a React component, call `useGetBacktestQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetBacktestQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetBacktestQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetBacktestQuery(baseOptions: Apollo.QueryHookOptions<GetBacktestQuery, GetBacktestQueryVariables> & ({ variables: GetBacktestQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetBacktestQuery, GetBacktestQueryVariables>(GetBacktestDocument, options);
      }
export function useGetBacktestLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetBacktestQuery, GetBacktestQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetBacktestQuery, GetBacktestQueryVariables>(GetBacktestDocument, options);
        }
export function useGetBacktestSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetBacktestQuery, GetBacktestQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetBacktestQuery, GetBacktestQueryVariables>(GetBacktestDocument, options);
        }
export type GetBacktestQueryHookResult = ReturnType<typeof useGetBacktestQuery>;
export type GetBacktestLazyQueryHookResult = ReturnType<typeof useGetBacktestLazyQuery>;
export type GetBacktestSuspenseQueryHookResult = ReturnType<typeof useGetBacktestSuspenseQuery>;
export type GetBacktestQueryResult = Apollo.QueryResult<GetBacktestQuery, GetBacktestQueryVariables>;
export const GetBacktestOptionsDocument = gql`
    query GetBacktestOptions {
  strategies(first: 50) {
    edges {
      node {
        id
        name
      }
    }
  }
  botRunners(first: 50) {
    edges {
      node {
        id
        name
        type
      }
    }
  }
}
    `;

/**
 * __useGetBacktestOptionsQuery__
 *
 * To run a query within a React component, call `useGetBacktestOptionsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetBacktestOptionsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetBacktestOptionsQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetBacktestOptionsQuery(baseOptions?: Apollo.QueryHookOptions<GetBacktestOptionsQuery, GetBacktestOptionsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetBacktestOptionsQuery, GetBacktestOptionsQueryVariables>(GetBacktestOptionsDocument, options);
      }
export function useGetBacktestOptionsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetBacktestOptionsQuery, GetBacktestOptionsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetBacktestOptionsQuery, GetBacktestOptionsQueryVariables>(GetBacktestOptionsDocument, options);
        }
export function useGetBacktestOptionsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetBacktestOptionsQuery, GetBacktestOptionsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetBacktestOptionsQuery, GetBacktestOptionsQueryVariables>(GetBacktestOptionsDocument, options);
        }
export type GetBacktestOptionsQueryHookResult = ReturnType<typeof useGetBacktestOptionsQuery>;
export type GetBacktestOptionsLazyQueryHookResult = ReturnType<typeof useGetBacktestOptionsLazyQuery>;
export type GetBacktestOptionsSuspenseQueryHookResult = ReturnType<typeof useGetBacktestOptionsSuspenseQuery>;
export type GetBacktestOptionsQueryResult = Apollo.QueryResult<GetBacktestOptionsQuery, GetBacktestOptionsQueryVariables>;
export const CreateBacktestDocument = gql`
    mutation CreateBacktest($input: CreateBacktestInput!) {
  createBacktest(input: $input) {
    id
    status
    config
    createdAt
  }
}
    `;
export type CreateBacktestMutationFn = Apollo.MutationFunction<CreateBacktestMutation, CreateBacktestMutationVariables>;

/**
 * __useCreateBacktestMutation__
 *
 * To run a mutation, you first call `useCreateBacktestMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateBacktestMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createBacktestMutation, { data, loading, error }] = useCreateBacktestMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateBacktestMutation(baseOptions?: Apollo.MutationHookOptions<CreateBacktestMutation, CreateBacktestMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateBacktestMutation, CreateBacktestMutationVariables>(CreateBacktestDocument, options);
      }
export type CreateBacktestMutationHookResult = ReturnType<typeof useCreateBacktestMutation>;
export type CreateBacktestMutationResult = Apollo.MutationResult<CreateBacktestMutation>;
export type CreateBacktestMutationOptions = Apollo.BaseMutationOptions<CreateBacktestMutation, CreateBacktestMutationVariables>;
export const UpdateBacktestDocument = gql`
    mutation UpdateBacktest($id: ID!, $input: UpdateBacktestInput!) {
  updateBacktest(id: $id, input: $input) {
    id
    status
    config
  }
}
    `;
export type UpdateBacktestMutationFn = Apollo.MutationFunction<UpdateBacktestMutation, UpdateBacktestMutationVariables>;

/**
 * __useUpdateBacktestMutation__
 *
 * To run a mutation, you first call `useUpdateBacktestMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateBacktestMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateBacktestMutation, { data, loading, error }] = useUpdateBacktestMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateBacktestMutation(baseOptions?: Apollo.MutationHookOptions<UpdateBacktestMutation, UpdateBacktestMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateBacktestMutation, UpdateBacktestMutationVariables>(UpdateBacktestDocument, options);
      }
export type UpdateBacktestMutationHookResult = ReturnType<typeof useUpdateBacktestMutation>;
export type UpdateBacktestMutationResult = Apollo.MutationResult<UpdateBacktestMutation>;
export type UpdateBacktestMutationOptions = Apollo.BaseMutationOptions<UpdateBacktestMutation, UpdateBacktestMutationVariables>;
export const DeleteBacktestDocument = gql`
    mutation DeleteBacktest($id: ID!) {
  deleteBacktest(id: $id)
}
    `;
export type DeleteBacktestMutationFn = Apollo.MutationFunction<DeleteBacktestMutation, DeleteBacktestMutationVariables>;

/**
 * __useDeleteBacktestMutation__
 *
 * To run a mutation, you first call `useDeleteBacktestMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteBacktestMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteBacktestMutation, { data, loading, error }] = useDeleteBacktestMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteBacktestMutation(baseOptions?: Apollo.MutationHookOptions<DeleteBacktestMutation, DeleteBacktestMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteBacktestMutation, DeleteBacktestMutationVariables>(DeleteBacktestDocument, options);
      }
export type DeleteBacktestMutationHookResult = ReturnType<typeof useDeleteBacktestMutation>;
export type DeleteBacktestMutationResult = Apollo.MutationResult<DeleteBacktestMutation>;
export type DeleteBacktestMutationOptions = Apollo.BaseMutationOptions<DeleteBacktestMutation, DeleteBacktestMutationVariables>;
export const RunBacktestDocument = gql`
    mutation RunBacktest($id: ID!) {
  runBacktest(id: $id) {
    id
    status
    containerID
  }
}
    `;
export type RunBacktestMutationFn = Apollo.MutationFunction<RunBacktestMutation, RunBacktestMutationVariables>;

/**
 * __useRunBacktestMutation__
 *
 * To run a mutation, you first call `useRunBacktestMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRunBacktestMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [runBacktestMutation, { data, loading, error }] = useRunBacktestMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useRunBacktestMutation(baseOptions?: Apollo.MutationHookOptions<RunBacktestMutation, RunBacktestMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RunBacktestMutation, RunBacktestMutationVariables>(RunBacktestDocument, options);
      }
export type RunBacktestMutationHookResult = ReturnType<typeof useRunBacktestMutation>;
export type RunBacktestMutationResult = Apollo.MutationResult<RunBacktestMutation>;
export type RunBacktestMutationOptions = Apollo.BaseMutationOptions<RunBacktestMutation, RunBacktestMutationVariables>;
export const StopBacktestDocument = gql`
    mutation StopBacktest($id: ID!) {
  stopBacktest(id: $id) {
    id
    status
  }
}
    `;
export type StopBacktestMutationFn = Apollo.MutationFunction<StopBacktestMutation, StopBacktestMutationVariables>;

/**
 * __useStopBacktestMutation__
 *
 * To run a mutation, you first call `useStopBacktestMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useStopBacktestMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [stopBacktestMutation, { data, loading, error }] = useStopBacktestMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useStopBacktestMutation(baseOptions?: Apollo.MutationHookOptions<StopBacktestMutation, StopBacktestMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<StopBacktestMutation, StopBacktestMutationVariables>(StopBacktestDocument, options);
      }
export type StopBacktestMutationHookResult = ReturnType<typeof useStopBacktestMutation>;
export type StopBacktestMutationResult = Apollo.MutationResult<StopBacktestMutation>;
export type StopBacktestMutationOptions = Apollo.BaseMutationOptions<StopBacktestMutation, StopBacktestMutationVariables>;
export const GetBotsDocument = gql`
    query GetBots($first: Int, $after: Cursor) {
  bots(first: $first, after: $after) {
    edges {
      node {
        id
        name
        status
        mode
        containerID
        freqtradeVersion
        lastSeenAt
        errorMessage
        createdAt
        config
        exchange {
          id
          name
        }
        strategy {
          id
          name
        }
        runner {
          id
          name
          type
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
 * __useGetBotsQuery__
 *
 * To run a query within a React component, call `useGetBotsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetBotsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetBotsQuery({
 *   variables: {
 *      first: // value for 'first'
 *      after: // value for 'after'
 *   },
 * });
 */
export function useGetBotsQuery(baseOptions?: Apollo.QueryHookOptions<GetBotsQuery, GetBotsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetBotsQuery, GetBotsQueryVariables>(GetBotsDocument, options);
      }
export function useGetBotsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetBotsQuery, GetBotsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetBotsQuery, GetBotsQueryVariables>(GetBotsDocument, options);
        }
export function useGetBotsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetBotsQuery, GetBotsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetBotsQuery, GetBotsQueryVariables>(GetBotsDocument, options);
        }
export type GetBotsQueryHookResult = ReturnType<typeof useGetBotsQuery>;
export type GetBotsLazyQueryHookResult = ReturnType<typeof useGetBotsLazyQuery>;
export type GetBotsSuspenseQueryHookResult = ReturnType<typeof useGetBotsSuspenseQuery>;
export type GetBotsQueryResult = Apollo.QueryResult<GetBotsQuery, GetBotsQueryVariables>;
export const GetBotDocument = gql`
    query GetBot($id: ID!) {
  node(id: $id) {
    ... on Bot {
      id
      name
      status
      mode
      containerID
      freqtradeVersion
      lastSeenAt
      errorMessage
      createdAt
      updatedAt
      config
      exchange {
        id
        name
      }
      strategy {
        id
        name
        description
        version
      }
      runner {
        id
        name
        type
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
          }
        }
        totalCount
      }
    }
  }
}
    `;

/**
 * __useGetBotQuery__
 *
 * To run a query within a React component, call `useGetBotQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetBotQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetBotQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetBotQuery(baseOptions: Apollo.QueryHookOptions<GetBotQuery, GetBotQueryVariables> & ({ variables: GetBotQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetBotQuery, GetBotQueryVariables>(GetBotDocument, options);
      }
export function useGetBotLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetBotQuery, GetBotQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetBotQuery, GetBotQueryVariables>(GetBotDocument, options);
        }
export function useGetBotSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetBotQuery, GetBotQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetBotQuery, GetBotQueryVariables>(GetBotDocument, options);
        }
export type GetBotQueryHookResult = ReturnType<typeof useGetBotQuery>;
export type GetBotLazyQueryHookResult = ReturnType<typeof useGetBotLazyQuery>;
export type GetBotSuspenseQueryHookResult = ReturnType<typeof useGetBotSuspenseQuery>;
export type GetBotQueryResult = Apollo.QueryResult<GetBotQuery, GetBotQueryVariables>;
export const GetBotRunnerStatusDocument = gql`
    query GetBotRunnerStatus($id: ID!) {
  getBotRunnerStatus(id: $id) {
    botID
    status
    containerID
    healthy
    lastSeenAt
    cpuUsage
    memoryUsage
    ipAddress
    hostPort
    errorMessage
    createdAt
    startedAt
    stoppedAt
  }
}
    `;

/**
 * __useGetBotRunnerStatusQuery__
 *
 * To run a query within a React component, call `useGetBotRunnerStatusQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetBotRunnerStatusQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetBotRunnerStatusQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetBotRunnerStatusQuery(baseOptions: Apollo.QueryHookOptions<GetBotRunnerStatusQuery, GetBotRunnerStatusQueryVariables> & ({ variables: GetBotRunnerStatusQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetBotRunnerStatusQuery, GetBotRunnerStatusQueryVariables>(GetBotRunnerStatusDocument, options);
      }
export function useGetBotRunnerStatusLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetBotRunnerStatusQuery, GetBotRunnerStatusQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetBotRunnerStatusQuery, GetBotRunnerStatusQueryVariables>(GetBotRunnerStatusDocument, options);
        }
export function useGetBotRunnerStatusSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetBotRunnerStatusQuery, GetBotRunnerStatusQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetBotRunnerStatusQuery, GetBotRunnerStatusQueryVariables>(GetBotRunnerStatusDocument, options);
        }
export type GetBotRunnerStatusQueryHookResult = ReturnType<typeof useGetBotRunnerStatusQuery>;
export type GetBotRunnerStatusLazyQueryHookResult = ReturnType<typeof useGetBotRunnerStatusLazyQuery>;
export type GetBotRunnerStatusSuspenseQueryHookResult = ReturnType<typeof useGetBotRunnerStatusSuspenseQuery>;
export type GetBotRunnerStatusQueryResult = Apollo.QueryResult<GetBotRunnerStatusQuery, GetBotRunnerStatusQueryVariables>;
export const CreateBotDocument = gql`
    mutation CreateBot($input: CreateBotInput!) {
  createBot(input: $input) {
    id
    name
    status
    mode
    freqtradeVersion
    config
  }
}
    `;
export type CreateBotMutationFn = Apollo.MutationFunction<CreateBotMutation, CreateBotMutationVariables>;

/**
 * __useCreateBotMutation__
 *
 * To run a mutation, you first call `useCreateBotMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateBotMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createBotMutation, { data, loading, error }] = useCreateBotMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateBotMutation(baseOptions?: Apollo.MutationHookOptions<CreateBotMutation, CreateBotMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateBotMutation, CreateBotMutationVariables>(CreateBotDocument, options);
      }
export type CreateBotMutationHookResult = ReturnType<typeof useCreateBotMutation>;
export type CreateBotMutationResult = Apollo.MutationResult<CreateBotMutation>;
export type CreateBotMutationOptions = Apollo.BaseMutationOptions<CreateBotMutation, CreateBotMutationVariables>;
export const UpdateBotDocument = gql`
    mutation UpdateBot($id: ID!, $input: UpdateBotInput!) {
  updateBot(id: $id, input: $input) {
    id
    name
    status
    mode
    config
  }
}
    `;
export type UpdateBotMutationFn = Apollo.MutationFunction<UpdateBotMutation, UpdateBotMutationVariables>;

/**
 * __useUpdateBotMutation__
 *
 * To run a mutation, you first call `useUpdateBotMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateBotMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateBotMutation, { data, loading, error }] = useUpdateBotMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateBotMutation(baseOptions?: Apollo.MutationHookOptions<UpdateBotMutation, UpdateBotMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateBotMutation, UpdateBotMutationVariables>(UpdateBotDocument, options);
      }
export type UpdateBotMutationHookResult = ReturnType<typeof useUpdateBotMutation>;
export type UpdateBotMutationResult = Apollo.MutationResult<UpdateBotMutation>;
export type UpdateBotMutationOptions = Apollo.BaseMutationOptions<UpdateBotMutation, UpdateBotMutationVariables>;
export const DeleteBotDocument = gql`
    mutation DeleteBot($id: ID!) {
  deleteBot(id: $id)
}
    `;
export type DeleteBotMutationFn = Apollo.MutationFunction<DeleteBotMutation, DeleteBotMutationVariables>;

/**
 * __useDeleteBotMutation__
 *
 * To run a mutation, you first call `useDeleteBotMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteBotMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteBotMutation, { data, loading, error }] = useDeleteBotMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteBotMutation(baseOptions?: Apollo.MutationHookOptions<DeleteBotMutation, DeleteBotMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteBotMutation, DeleteBotMutationVariables>(DeleteBotDocument, options);
      }
export type DeleteBotMutationHookResult = ReturnType<typeof useDeleteBotMutation>;
export type DeleteBotMutationResult = Apollo.MutationResult<DeleteBotMutation>;
export type DeleteBotMutationOptions = Apollo.BaseMutationOptions<DeleteBotMutation, DeleteBotMutationVariables>;
export const StartBotDocument = gql`
    mutation StartBot($id: ID!) {
  startBot(id: $id) {
    id
    name
    status
  }
}
    `;
export type StartBotMutationFn = Apollo.MutationFunction<StartBotMutation, StartBotMutationVariables>;

/**
 * __useStartBotMutation__
 *
 * To run a mutation, you first call `useStartBotMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useStartBotMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [startBotMutation, { data, loading, error }] = useStartBotMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useStartBotMutation(baseOptions?: Apollo.MutationHookOptions<StartBotMutation, StartBotMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<StartBotMutation, StartBotMutationVariables>(StartBotDocument, options);
      }
export type StartBotMutationHookResult = ReturnType<typeof useStartBotMutation>;
export type StartBotMutationResult = Apollo.MutationResult<StartBotMutation>;
export type StartBotMutationOptions = Apollo.BaseMutationOptions<StartBotMutation, StartBotMutationVariables>;
export const StopBotDocument = gql`
    mutation StopBot($id: ID!) {
  stopBot(id: $id) {
    id
    name
    status
  }
}
    `;
export type StopBotMutationFn = Apollo.MutationFunction<StopBotMutation, StopBotMutationVariables>;

/**
 * __useStopBotMutation__
 *
 * To run a mutation, you first call `useStopBotMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useStopBotMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [stopBotMutation, { data, loading, error }] = useStopBotMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useStopBotMutation(baseOptions?: Apollo.MutationHookOptions<StopBotMutation, StopBotMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<StopBotMutation, StopBotMutationVariables>(StopBotDocument, options);
      }
export type StopBotMutationHookResult = ReturnType<typeof useStopBotMutation>;
export type StopBotMutationResult = Apollo.MutationResult<StopBotMutation>;
export type StopBotMutationOptions = Apollo.BaseMutationOptions<StopBotMutation, StopBotMutationVariables>;
export const RestartBotDocument = gql`
    mutation RestartBot($id: ID!) {
  restartBot(id: $id) {
    id
    name
    status
  }
}
    `;
export type RestartBotMutationFn = Apollo.MutationFunction<RestartBotMutation, RestartBotMutationVariables>;

/**
 * __useRestartBotMutation__
 *
 * To run a mutation, you first call `useRestartBotMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRestartBotMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [restartBotMutation, { data, loading, error }] = useRestartBotMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useRestartBotMutation(baseOptions?: Apollo.MutationHookOptions<RestartBotMutation, RestartBotMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RestartBotMutation, RestartBotMutationVariables>(RestartBotDocument, options);
      }
export type RestartBotMutationHookResult = ReturnType<typeof useRestartBotMutation>;
export type RestartBotMutationResult = Apollo.MutationResult<RestartBotMutation>;
export type RestartBotMutationOptions = Apollo.BaseMutationOptions<RestartBotMutation, RestartBotMutationVariables>;
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
  exchanges {
    id
    name
  }
  strategies(first: 10) {
    edges {
      node {
        id
        name
        version
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
export const GetExchangesDocument = gql`
    query GetExchanges {
  exchanges {
    id
    name
    config
    createdAt
    updatedAt
    bots(first: 10) {
      totalCount
    }
  }
}
    `;

/**
 * __useGetExchangesQuery__
 *
 * To run a query within a React component, call `useGetExchangesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetExchangesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetExchangesQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetExchangesQuery(baseOptions?: Apollo.QueryHookOptions<GetExchangesQuery, GetExchangesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetExchangesQuery, GetExchangesQueryVariables>(GetExchangesDocument, options);
      }
export function useGetExchangesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetExchangesQuery, GetExchangesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetExchangesQuery, GetExchangesQueryVariables>(GetExchangesDocument, options);
        }
export function useGetExchangesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetExchangesQuery, GetExchangesQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetExchangesQuery, GetExchangesQueryVariables>(GetExchangesDocument, options);
        }
export type GetExchangesQueryHookResult = ReturnType<typeof useGetExchangesQuery>;
export type GetExchangesLazyQueryHookResult = ReturnType<typeof useGetExchangesLazyQuery>;
export type GetExchangesSuspenseQueryHookResult = ReturnType<typeof useGetExchangesSuspenseQuery>;
export type GetExchangesQueryResult = Apollo.QueryResult<GetExchangesQuery, GetExchangesQueryVariables>;
export const GetExchangeDocument = gql`
    query GetExchange($id: ID!) {
  node(id: $id) {
    ... on Exchange {
      id
      name
      config
      createdAt
      updatedAt
      bots(first: 50) {
        edges {
          node {
            id
            name
            status
          }
        }
        totalCount
      }
    }
  }
}
    `;

/**
 * __useGetExchangeQuery__
 *
 * To run a query within a React component, call `useGetExchangeQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetExchangeQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetExchangeQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetExchangeQuery(baseOptions: Apollo.QueryHookOptions<GetExchangeQuery, GetExchangeQueryVariables> & ({ variables: GetExchangeQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetExchangeQuery, GetExchangeQueryVariables>(GetExchangeDocument, options);
      }
export function useGetExchangeLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetExchangeQuery, GetExchangeQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetExchangeQuery, GetExchangeQueryVariables>(GetExchangeDocument, options);
        }
export function useGetExchangeSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetExchangeQuery, GetExchangeQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetExchangeQuery, GetExchangeQueryVariables>(GetExchangeDocument, options);
        }
export type GetExchangeQueryHookResult = ReturnType<typeof useGetExchangeQuery>;
export type GetExchangeLazyQueryHookResult = ReturnType<typeof useGetExchangeLazyQuery>;
export type GetExchangeSuspenseQueryHookResult = ReturnType<typeof useGetExchangeSuspenseQuery>;
export type GetExchangeQueryResult = Apollo.QueryResult<GetExchangeQuery, GetExchangeQueryVariables>;
export const CreateExchangeDocument = gql`
    mutation CreateExchange($input: CreateExchangeInput!) {
  createExchange(input: $input) {
    id
    name
    config
  }
}
    `;
export type CreateExchangeMutationFn = Apollo.MutationFunction<CreateExchangeMutation, CreateExchangeMutationVariables>;

/**
 * __useCreateExchangeMutation__
 *
 * To run a mutation, you first call `useCreateExchangeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateExchangeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createExchangeMutation, { data, loading, error }] = useCreateExchangeMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateExchangeMutation(baseOptions?: Apollo.MutationHookOptions<CreateExchangeMutation, CreateExchangeMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateExchangeMutation, CreateExchangeMutationVariables>(CreateExchangeDocument, options);
      }
export type CreateExchangeMutationHookResult = ReturnType<typeof useCreateExchangeMutation>;
export type CreateExchangeMutationResult = Apollo.MutationResult<CreateExchangeMutation>;
export type CreateExchangeMutationOptions = Apollo.BaseMutationOptions<CreateExchangeMutation, CreateExchangeMutationVariables>;
export const UpdateExchangeDocument = gql`
    mutation UpdateExchange($id: ID!, $input: UpdateExchangeInput!) {
  updateExchange(id: $id, input: $input) {
    id
    name
    config
  }
}
    `;
export type UpdateExchangeMutationFn = Apollo.MutationFunction<UpdateExchangeMutation, UpdateExchangeMutationVariables>;

/**
 * __useUpdateExchangeMutation__
 *
 * To run a mutation, you first call `useUpdateExchangeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateExchangeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateExchangeMutation, { data, loading, error }] = useUpdateExchangeMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateExchangeMutation(baseOptions?: Apollo.MutationHookOptions<UpdateExchangeMutation, UpdateExchangeMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateExchangeMutation, UpdateExchangeMutationVariables>(UpdateExchangeDocument, options);
      }
export type UpdateExchangeMutationHookResult = ReturnType<typeof useUpdateExchangeMutation>;
export type UpdateExchangeMutationResult = Apollo.MutationResult<UpdateExchangeMutation>;
export type UpdateExchangeMutationOptions = Apollo.BaseMutationOptions<UpdateExchangeMutation, UpdateExchangeMutationVariables>;
export const DeleteExchangeDocument = gql`
    mutation DeleteExchange($id: ID!) {
  deleteExchange(id: $id)
}
    `;
export type DeleteExchangeMutationFn = Apollo.MutationFunction<DeleteExchangeMutation, DeleteExchangeMutationVariables>;

/**
 * __useDeleteExchangeMutation__
 *
 * To run a mutation, you first call `useDeleteExchangeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteExchangeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteExchangeMutation, { data, loading, error }] = useDeleteExchangeMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteExchangeMutation(baseOptions?: Apollo.MutationHookOptions<DeleteExchangeMutation, DeleteExchangeMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteExchangeMutation, DeleteExchangeMutationVariables>(DeleteExchangeDocument, options);
      }
export type DeleteExchangeMutationHookResult = ReturnType<typeof useDeleteExchangeMutation>;
export type DeleteExchangeMutationResult = Apollo.MutationResult<DeleteExchangeMutation>;
export type DeleteExchangeMutationOptions = Apollo.BaseMutationOptions<DeleteExchangeMutation, DeleteExchangeMutationVariables>;
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
  exchanges {
    id
    name
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
export const GetRunnersDocument = gql`
    query GetRunners($first: Int, $after: Cursor) {
  botRunners(first: $first, after: $after) {
    edges {
      node {
        id
        name
        type
        createdAt
        bots {
          totalCount
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
 * __useGetRunnersQuery__
 *
 * To run a query within a React component, call `useGetRunnersQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetRunnersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetRunnersQuery({
 *   variables: {
 *      first: // value for 'first'
 *      after: // value for 'after'
 *   },
 * });
 */
export function useGetRunnersQuery(baseOptions?: Apollo.QueryHookOptions<GetRunnersQuery, GetRunnersQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetRunnersQuery, GetRunnersQueryVariables>(GetRunnersDocument, options);
      }
export function useGetRunnersLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetRunnersQuery, GetRunnersQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetRunnersQuery, GetRunnersQueryVariables>(GetRunnersDocument, options);
        }
export function useGetRunnersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetRunnersQuery, GetRunnersQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetRunnersQuery, GetRunnersQueryVariables>(GetRunnersDocument, options);
        }
export type GetRunnersQueryHookResult = ReturnType<typeof useGetRunnersQuery>;
export type GetRunnersLazyQueryHookResult = ReturnType<typeof useGetRunnersLazyQuery>;
export type GetRunnersSuspenseQueryHookResult = ReturnType<typeof useGetRunnersSuspenseQuery>;
export type GetRunnersQueryResult = Apollo.QueryResult<GetRunnersQuery, GetRunnersQueryVariables>;
export const GetRunnerDocument = gql`
    query GetRunner($id: ID!) {
  node(id: $id) {
    ... on BotRunner {
      id
      name
      type
      createdAt
      bots {
        totalCount
      }
    }
  }
}
    `;

/**
 * __useGetRunnerQuery__
 *
 * To run a query within a React component, call `useGetRunnerQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetRunnerQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetRunnerQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetRunnerQuery(baseOptions: Apollo.QueryHookOptions<GetRunnerQuery, GetRunnerQueryVariables> & ({ variables: GetRunnerQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetRunnerQuery, GetRunnerQueryVariables>(GetRunnerDocument, options);
      }
export function useGetRunnerLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetRunnerQuery, GetRunnerQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetRunnerQuery, GetRunnerQueryVariables>(GetRunnerDocument, options);
        }
export function useGetRunnerSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetRunnerQuery, GetRunnerQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetRunnerQuery, GetRunnerQueryVariables>(GetRunnerDocument, options);
        }
export type GetRunnerQueryHookResult = ReturnType<typeof useGetRunnerQuery>;
export type GetRunnerLazyQueryHookResult = ReturnType<typeof useGetRunnerLazyQuery>;
export type GetRunnerSuspenseQueryHookResult = ReturnType<typeof useGetRunnerSuspenseQuery>;
export type GetRunnerQueryResult = Apollo.QueryResult<GetRunnerQuery, GetRunnerQueryVariables>;
export const CreateRunnerDocument = gql`
    mutation CreateRunner($input: CreateBotRunnerInput!) {
  createBotRunner(input: $input) {
    id
    name
    type
  }
}
    `;
export type CreateRunnerMutationFn = Apollo.MutationFunction<CreateRunnerMutation, CreateRunnerMutationVariables>;

/**
 * __useCreateRunnerMutation__
 *
 * To run a mutation, you first call `useCreateRunnerMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateRunnerMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createRunnerMutation, { data, loading, error }] = useCreateRunnerMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateRunnerMutation(baseOptions?: Apollo.MutationHookOptions<CreateRunnerMutation, CreateRunnerMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateRunnerMutation, CreateRunnerMutationVariables>(CreateRunnerDocument, options);
      }
export type CreateRunnerMutationHookResult = ReturnType<typeof useCreateRunnerMutation>;
export type CreateRunnerMutationResult = Apollo.MutationResult<CreateRunnerMutation>;
export type CreateRunnerMutationOptions = Apollo.BaseMutationOptions<CreateRunnerMutation, CreateRunnerMutationVariables>;
export const UpdateRunnerDocument = gql`
    mutation UpdateRunner($id: ID!, $input: UpdateBotRunnerInput!) {
  updateBotRunner(id: $id, input: $input) {
    id
    name
    type
  }
}
    `;
export type UpdateRunnerMutationFn = Apollo.MutationFunction<UpdateRunnerMutation, UpdateRunnerMutationVariables>;

/**
 * __useUpdateRunnerMutation__
 *
 * To run a mutation, you first call `useUpdateRunnerMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateRunnerMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateRunnerMutation, { data, loading, error }] = useUpdateRunnerMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateRunnerMutation(baseOptions?: Apollo.MutationHookOptions<UpdateRunnerMutation, UpdateRunnerMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateRunnerMutation, UpdateRunnerMutationVariables>(UpdateRunnerDocument, options);
      }
export type UpdateRunnerMutationHookResult = ReturnType<typeof useUpdateRunnerMutation>;
export type UpdateRunnerMutationResult = Apollo.MutationResult<UpdateRunnerMutation>;
export type UpdateRunnerMutationOptions = Apollo.BaseMutationOptions<UpdateRunnerMutation, UpdateRunnerMutationVariables>;
export const DeleteRunnerDocument = gql`
    mutation DeleteRunner($id: ID!) {
  deleteBotRunner(id: $id)
}
    `;
export type DeleteRunnerMutationFn = Apollo.MutationFunction<DeleteRunnerMutation, DeleteRunnerMutationVariables>;

/**
 * __useDeleteRunnerMutation__
 *
 * To run a mutation, you first call `useDeleteRunnerMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteRunnerMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteRunnerMutation, { data, loading, error }] = useDeleteRunnerMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteRunnerMutation(baseOptions?: Apollo.MutationHookOptions<DeleteRunnerMutation, DeleteRunnerMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteRunnerMutation, DeleteRunnerMutationVariables>(DeleteRunnerDocument, options);
      }
export type DeleteRunnerMutationHookResult = ReturnType<typeof useDeleteRunnerMutation>;
export type DeleteRunnerMutationResult = Apollo.MutationResult<DeleteRunnerMutation>;
export type DeleteRunnerMutationOptions = Apollo.BaseMutationOptions<DeleteRunnerMutation, DeleteRunnerMutationVariables>;
export const GetStrategiesDocument = gql`
    query GetStrategies($first: Int, $after: Cursor) {
  strategies(first: $first, after: $after) {
    edges {
      node {
        id
        name
        description
        code
        version
        config
        createdAt
        bots {
          totalCount
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
 * __useGetStrategiesQuery__
 *
 * To run a query within a React component, call `useGetStrategiesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetStrategiesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetStrategiesQuery({
 *   variables: {
 *      first: // value for 'first'
 *      after: // value for 'after'
 *   },
 * });
 */
export function useGetStrategiesQuery(baseOptions?: Apollo.QueryHookOptions<GetStrategiesQuery, GetStrategiesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetStrategiesQuery, GetStrategiesQueryVariables>(GetStrategiesDocument, options);
      }
export function useGetStrategiesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetStrategiesQuery, GetStrategiesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetStrategiesQuery, GetStrategiesQueryVariables>(GetStrategiesDocument, options);
        }
export function useGetStrategiesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetStrategiesQuery, GetStrategiesQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetStrategiesQuery, GetStrategiesQueryVariables>(GetStrategiesDocument, options);
        }
export type GetStrategiesQueryHookResult = ReturnType<typeof useGetStrategiesQuery>;
export type GetStrategiesLazyQueryHookResult = ReturnType<typeof useGetStrategiesLazyQuery>;
export type GetStrategiesSuspenseQueryHookResult = ReturnType<typeof useGetStrategiesSuspenseQuery>;
export type GetStrategiesQueryResult = Apollo.QueryResult<GetStrategiesQuery, GetStrategiesQueryVariables>;
export const CreateStrategyDocument = gql`
    mutation CreateStrategy($input: CreateStrategyInput!) {
  createStrategy(input: $input) {
    id
    name
    description
    code
    version
    config
  }
}
    `;
export type CreateStrategyMutationFn = Apollo.MutationFunction<CreateStrategyMutation, CreateStrategyMutationVariables>;

/**
 * __useCreateStrategyMutation__
 *
 * To run a mutation, you first call `useCreateStrategyMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateStrategyMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createStrategyMutation, { data, loading, error }] = useCreateStrategyMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateStrategyMutation(baseOptions?: Apollo.MutationHookOptions<CreateStrategyMutation, CreateStrategyMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateStrategyMutation, CreateStrategyMutationVariables>(CreateStrategyDocument, options);
      }
export type CreateStrategyMutationHookResult = ReturnType<typeof useCreateStrategyMutation>;
export type CreateStrategyMutationResult = Apollo.MutationResult<CreateStrategyMutation>;
export type CreateStrategyMutationOptions = Apollo.BaseMutationOptions<CreateStrategyMutation, CreateStrategyMutationVariables>;
export const UpdateStrategyDocument = gql`
    mutation UpdateStrategy($id: ID!, $input: UpdateStrategyInput!) {
  updateStrategy(id: $id, input: $input) {
    id
    name
    description
    code
    version
    config
  }
}
    `;
export type UpdateStrategyMutationFn = Apollo.MutationFunction<UpdateStrategyMutation, UpdateStrategyMutationVariables>;

/**
 * __useUpdateStrategyMutation__
 *
 * To run a mutation, you first call `useUpdateStrategyMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateStrategyMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateStrategyMutation, { data, loading, error }] = useUpdateStrategyMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateStrategyMutation(baseOptions?: Apollo.MutationHookOptions<UpdateStrategyMutation, UpdateStrategyMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateStrategyMutation, UpdateStrategyMutationVariables>(UpdateStrategyDocument, options);
      }
export type UpdateStrategyMutationHookResult = ReturnType<typeof useUpdateStrategyMutation>;
export type UpdateStrategyMutationResult = Apollo.MutationResult<UpdateStrategyMutation>;
export type UpdateStrategyMutationOptions = Apollo.BaseMutationOptions<UpdateStrategyMutation, UpdateStrategyMutationVariables>;
export const DeleteStrategyDocument = gql`
    mutation DeleteStrategy($id: ID!) {
  deleteStrategy(id: $id)
}
    `;
export type DeleteStrategyMutationFn = Apollo.MutationFunction<DeleteStrategyMutation, DeleteStrategyMutationVariables>;

/**
 * __useDeleteStrategyMutation__
 *
 * To run a mutation, you first call `useDeleteStrategyMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteStrategyMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteStrategyMutation, { data, loading, error }] = useDeleteStrategyMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteStrategyMutation(baseOptions?: Apollo.MutationHookOptions<DeleteStrategyMutation, DeleteStrategyMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteStrategyMutation, DeleteStrategyMutationVariables>(DeleteStrategyDocument, options);
      }
export type DeleteStrategyMutationHookResult = ReturnType<typeof useDeleteStrategyMutation>;
export type DeleteStrategyMutationResult = Apollo.MutationResult<DeleteStrategyMutation>;
export type DeleteStrategyMutationOptions = Apollo.BaseMutationOptions<DeleteStrategyMutation, DeleteStrategyMutationVariables>;