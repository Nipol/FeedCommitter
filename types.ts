export type Ticker = {
  type: string;
  code: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  prev_closing_price: number;
  acc_trade_price: bigint;
  change: string;
  change_price: number;
  signed_change_price: number;
  change_rate: number;
  signed_change_rate: number;
  ask_bid: string;
  trade_volume: number;
  acc_trade_volume: bigint;
  trade_date: string;
  trade_time: string;
  trade_timestamp: number;
  acc_ask_volume: bigint; //
  acc_bid_volume: bigint;
  highest_52_week_price: number;
  highest_52_week_date: string;
  lowest_52_week_price: number;
  lowest_52_week_date: string;
  market_state: string;
  is_trading_suspended: boolean;
  delisting_date: null;
  market_warning: string;
  timestamp: number;
  acc_trade_price_24h: bigint;
  acc_trade_volume_24h: bigint;
  stream_type: string;
};

export type ChainInfo = {
  chainId: number;
  rpc: string;
  privKey: string;
  targetAddr: string;
};

export type ResponseBody = {
  "result": string;
  "error_code": string;
  "server_time": number;
  "quote_currency": string;
  "target_currency": string;
  "transactions": Transaction[];
};

export type Transaction = {
  "id": string;
  "timestamp": number;
  "price": string;
  "qty": string;
  "is_seller_maker": boolean;
};
