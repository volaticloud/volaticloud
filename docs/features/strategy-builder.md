# Strategy UI Builder

The Strategy UI Builder provides a visual interface for creating trading strategies without writing code. It generates Python code that runs on the Freqtrade framework.

## Overview

The UI Builder allows you to:

- Configure technical indicators (RSI, MACD, Bollinger Bands, etc.)
- Build entry/exit conditions using a visual condition tree
- Set strategy parameters (stoploss, ROI, trailing stop)
- Preview generated Python code in real-time
- Optionally "eject" to code mode for advanced customization

## Getting Started

### Creating a New Strategy

1. Navigate to **Strategies** in the dashboard
2. Click **Create Strategy**
3. Select **UI Builder** mode
4. Configure your strategy using the visual interface

### Strategy Modes

Strategies can be edited in two modes:

| Mode | Description |
|------|-------------|
| **UI Mode** | Visual builder with drag-and-drop conditions |
| **Code Mode** | Direct Python code editing |

**Note:** Ejecting from UI mode to Code mode is **one-way**. Once ejected, you cannot return to UI mode because manual code changes cannot be reverse-parsed.

## Indicators

### Available Indicators

| Category | Indicators |
|----------|------------|
| **Trend** | SMA, EMA, WMA, DEMA, TEMA, KAMA |
| **Momentum** | RSI, MACD, Stochastic, Stochastic RSI, CCI, Williams %R, MOM, ROC |
| **Volatility** | Bollinger Bands, Keltner Channel, ATR |
| **Volume** | OBV, MFI, VWAP, CMF, AD |
| **Advanced** | Ichimoku, SAR, Pivot Points, Supertrend, ADX |

### Adding Indicators

1. Click **Add Indicator** in the Indicators panel
2. Select the indicator type
3. Configure parameters (period, source, etc.)
4. Click **Add**

Each indicator gets a unique ID (e.g., `rsi_1`, `ema_fast`) that you reference in conditions.

### Indicator Parameters

Most indicators support these common parameters:

- **Period**: Number of candles for calculation (e.g., RSI 14)
- **Source**: Price data to use (close, open, high, low, hlc3, ohlc4)

## Condition Tree

### Building Conditions

The condition tree defines when your strategy enters and exits trades.

#### Logical Operators

| Operator | Description |
|----------|-------------|
| **AND** | All conditions must be true |
| **OR** | Any condition must be true |
| **NOT** | Inverts the condition |
| **IF-THEN-ELSE** | Conditional branching |

#### Comparison Operators

| Symbol | Meaning |
|--------|---------|
| `=` | Equals |
| `!=` | Not equals |
| `>` | Greater than |
| `>=` | Greater than or equal |
| `<` | Less than |
| `<=` | Less than or equal |

#### Special Conditions

| Type | Description |
|------|-------------|
| **Crossover** | Series 1 crosses above Series 2 |
| **Crossunder** | Series 1 crosses below Series 2 |
| **In Range** | Value is between min and max |

### Example: RSI Oversold Entry

```
Entry Conditions:
  AND
    ├── RSI (14) < 30
    └── Volume > 1000000
```

### Example: EMA Crossover with RSI Filter

```
Entry Conditions:
  AND
    ├── EMA (10) crosses above EMA (20)
    └── NOT
        └── RSI (14) > 70
```

### Example: Conditional Entry (IF-THEN-ELSE)

```
Entry Conditions:
  IF
    ADX (14) > 25
  THEN
    AND
      ├── RSI (14) < 30
      └── MACD histogram > 0
  ELSE
    RSI (14) < 20
```

## Strategy Parameters

### Stoploss

Sets the maximum loss per trade as a negative percentage.

| Setting | Example | Description |
|---------|---------|-------------|
| Stoploss | -0.10 | Exit at 10% loss |

### Minimal ROI

Defines profit targets at different time points.

```json
{
  "0": 0.10,    // Take 10% profit immediately
  "30": 0.05,  // Take 5% profit after 30 minutes
  "60": 0.02   // Take 2% profit after 60 minutes
}
```

### Trailing Stop

Dynamically adjusts stoploss as price moves in your favor.

| Setting | Description |
|---------|-------------|
| Trailing Stop | Enable/disable trailing |
| Trailing Stop Positive | Activate trailing when profit reaches this % |
| Trailing Stop Positive Offset | Distance to maintain from peak |

## Callbacks (Advanced)

### Custom Stoploss

Define dynamic stoploss rules based on profit:

```
Rules:
  - If profit > 5%, set stoploss to -1%
  - If profit > 2%, set stoploss to -2%
  - Default: -10%
```

### DCA (Dollar Cost Averaging)

Add to position when price drops:

```
DCA Rules:
  - At -5% loss, add 1.5x stake
  - At -10% loss, add 2x stake
  Max entries: 3
  Cooldown: 60 minutes
```

### Confirm Entry

Additional filters before entering:

```
Confirm Entry:
  AND
    ├── Volume ratio > 1.5
    └── Spread < 0.5%
```

## Code Preview

The code preview panel shows the generated Python code in real-time. This is the actual code that will run on Freqtrade.

### Generated Code Structure

```python
class MyStrategy(IStrategy):
    # Parameters
    timeframe = '5m'
    stoploss = -0.10
    minimal_roi = {"0": 0.10}

    def populate_indicators(self, dataframe, metadata):
        # Indicator calculations
        dataframe['rsi_1'] = ta.RSI(dataframe, timeperiod=14)
        return dataframe

    def populate_entry_trend(self, dataframe, metadata):
        # Entry conditions
        dataframe['enter_long'] = (
            dataframe['rsi_1'] < 30
        ).astype(int)
        return dataframe

    def populate_exit_trend(self, dataframe, metadata):
        # Exit conditions
        dataframe['exit_long'] = (
            dataframe['rsi_1'] > 70
        ).astype(int)
        return dataframe
```

## Ejecting to Code Mode

If you need features not available in the UI Builder:

1. Click **Eject to Code** in the strategy editor
2. Confirm the one-way conversion
3. Edit the Python code directly

**Warning:** Ejection is permanent. Make sure to save a backup if needed.

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Empty conditions | Add at least one condition to AND/OR groups |
| Missing indicator | Add the indicator before referencing it in conditions |
| Invalid parameters | Check indicator parameter ranges |

### Validation Errors

The UI Builder validates your configuration before generating code:

- All referenced indicators must exist
- Condition tree must not be empty
- Parameters must be within valid ranges

## Related Documentation

- [ADR-0011: Strategy UI Builder Architecture](../adr/0011-strategy-ui-builder.md)
- [ADR-0003: Strategy Immutable Versioning](../adr/0003-strategy-immutable-versioning.md)
- [Strategy Package Documentation](../../internal/strategy/doc.go)
