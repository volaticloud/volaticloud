/**
 * Default code template for new strategies (UI Builder mode)
 * Used by both CreateStrategyNameDrawer and StrategyStudio
 */
export const DEFAULT_STRATEGY_CODE = `# pragma pylint: disable=missing-docstring, invalid-name, pointless-string-statement
from freqtrade.strategy import IStrategy
from pandas import DataFrame


class MyStrategy(IStrategy):
    """
    Sample strategy - customize this for your trading logic
    """

    # Strategy parameters
    minimal_roi = {"0": 0.1}
    stoploss = -0.10
    timeframe = '5m'

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # Add your indicators here
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # Define entry conditions
        dataframe['enter_long'] = 0
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # Define exit conditions
        dataframe['exit_long'] = 0
        return dataframe
`;
