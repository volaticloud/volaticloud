package runner

import (
	"context"
	"fmt"
	"strings"
	"time"

	"volaticloud/internal/enum"
)

// DataDownloader downloads historical data on the runner infrastructure
// (Docker host or Kubernetes cluster) and uploads to S3.
type DataDownloader interface {
	// StartDownload starts a data download task on the runner infrastructure.
	// Returns a task ID that can be used to monitor progress.
	StartDownload(ctx context.Context, spec DataDownloadSpec) (taskID string, err error)

	// GetDownloadStatus returns the current status of a download task.
	GetDownloadStatus(ctx context.Context, taskID string) (*DataDownloadStatus, error)

	// GetDownloadLogs returns logs from a download task.
	GetDownloadLogs(ctx context.Context, taskID string) (string, error)

	// CancelDownload cancels a running download task.
	CancelDownload(ctx context.Context, taskID string) error

	// CleanupDownload removes resources for a completed/failed download task.
	CleanupDownload(ctx context.Context, taskID string) error
}

// DataDownloadSpec contains the specification for a data download task.
type DataDownloadSpec struct {
	// RunnerID is the unique identifier of the runner.
	RunnerID string

	// ExistingDataURL is a presigned GET URL for downloading existing data (for incremental updates).
	// Empty string means download from scratch.
	ExistingDataURL string

	// UploadURL is a presigned PUT URL for uploading the result to S3.
	UploadURL string

	// FreqtradeImage is the Docker image to use for freqtrade (e.g., "freqtradeorg/freqtrade:stable").
	FreqtradeImage string

	// ExchangeConfigs contains the download configuration for each exchange.
	ExchangeConfigs []ExchangeDownloadConfig
}

// ExchangeDownloadConfig contains download configuration for a single exchange.
type ExchangeDownloadConfig struct {
	// Name is the exchange name (e.g., "binance", "bybit").
	Name string

	// PairsPattern is the pair pattern to download (e.g., "BTC/USDT:USDT", ".*/USDT").
	PairsPattern string

	// Timeframes are the timeframes to download (e.g., ["5m", "1h", "4h"]).
	Timeframes []string

	// Days is the number of days of historical data to download.
	Days int

	// TradingMode is the trading mode ("spot" or "futures").
	TradingMode string
}

// DataDownloadStatus contains the current status of a download task.
type DataDownloadStatus struct {
	// TaskID is the unique identifier of the download task.
	TaskID string

	// Status is the current status of the download.
	Status enum.DataDownloadStatus

	// Progress is the completion percentage (0-100).
	Progress float64

	// CurrentPhase describes what's currently happening
	// (e.g., "downloading binance", "packaging", "uploading").
	CurrentPhase string

	// ErrorMessage contains error details if the download failed.
	ErrorMessage string

	// StartedAt is when the download task started.
	StartedAt *time.Time

	// CompletedAt is when the download task completed (success or failure).
	CompletedAt *time.Time
}

// DataDownloaderCreator is a factory function for creating DataDownloader instances.
type DataDownloaderCreator func(ctx context.Context, config map[string]interface{}) (DataDownloader, error)

// ShellEscape escapes a string for safe use in shell commands.
// It wraps the string in single quotes and escapes any embedded single quotes.
// This prevents shell injection attacks when inserting user input into shell scripts.
func ShellEscape(s string) string {
	// Single quotes prevent all shell interpretation except for single quotes themselves.
	// To include a single quote, we end the quoted string, add an escaped single quote,
	// and start a new quoted string: 'foo'\''bar' represents foo'bar
	escaped := "'"
	for _, c := range s {
		if c == '\'' {
			escaped += `'\''`
		} else {
			escaped += string(c)
		}
	}
	escaped += "'"
	return escaped
}

// BuildDownloadScript creates the shell script for data download.
// Uses Python (available in freqtrade image) for S3 operations.
// Set verbose=true to include additional debug output (useful for Docker development).
func BuildDownloadScript(spec DataDownloadSpec, verbose bool) string {
	var sb strings.Builder

	sb.WriteString("set -e\n")
	sb.WriteString("cd /tmp\n\n")

	// Setup user_data directory structure
	sb.WriteString("# Setup user_data directory\n")
	sb.WriteString("mkdir -p /freqtrade/user_data/data\n\n")

	// Phase 1: Download existing data for incremental update
	sb.WriteString("# Phase 1: Download existing data for incremental update\n")
	sb.WriteString("if [ -n \"$EXISTING_DATA_URL\" ]; then\n")
	sb.WriteString("    echo \"Downloading existing data for incremental update...\"\n")
	sb.WriteString("    python3 -c \"\n")
	sb.WriteString("import urllib.request\n")
	sb.WriteString("import os\n")
	sb.WriteString("url = os.environ.get('EXISTING_DATA_URL', '')\n")
	sb.WriteString("if url:\n")
	sb.WriteString("    try:\n")
	sb.WriteString("        urllib.request.urlretrieve(url, '/tmp/existing.tar.gz')\n")
	sb.WriteString("        print('Downloaded existing data')\n")
	sb.WriteString("    except Exception as e:\n")
	sb.WriteString("        print(f'No existing data available: {e}')\n")
	sb.WriteString("\" || true\n")
	sb.WriteString("    if [ -f existing.tar.gz ]; then\n")
	sb.WriteString("        tar -xzf existing.tar.gz -C /freqtrade/user_data/data\n")
	sb.WriteString("        rm existing.tar.gz\n")
	sb.WriteString("        echo \"Existing data extracted successfully\"\n")
	sb.WriteString("    fi\n")
	sb.WriteString("fi\n\n")

	// Phase 2: Download new data for each exchange
	sb.WriteString("# Phase 2: Download new data for each exchange\n")
	for _, exch := range spec.ExchangeConfigs {
		// Shell-escape user-controlled values to prevent injection
		escapedName := ShellEscape(exch.Name)
		escapedPairs := ShellEscape(exch.PairsPattern)
		escapedMode := ShellEscape(exch.TradingMode)
		var escapedTimeframes []string
		for _, tf := range exch.Timeframes {
			escapedTimeframes = append(escapedTimeframes, ShellEscape(tf))
		}

		sb.WriteString(fmt.Sprintf("echo \"Downloading %s data...\"\n", exch.Name))
		sb.WriteString("freqtrade download-data \\\n")
		sb.WriteString("    --userdir /freqtrade/user_data \\\n")
		sb.WriteString(fmt.Sprintf("    --exchange %s \\\n", escapedName))
		sb.WriteString(fmt.Sprintf("    --pairs %s \\\n", escapedPairs))
		sb.WriteString(fmt.Sprintf("    --timeframes %s \\\n", strings.Join(escapedTimeframes, " ")))
		sb.WriteString(fmt.Sprintf("    --days %d \\\n", exch.Days))
		sb.WriteString(fmt.Sprintf("    --trading-mode %s \\\n", escapedMode))
		sb.WriteString("    --data-format-ohlcv json\n\n")
	}

	// Phase 3: Package data with tar.gz
	sb.WriteString("# Phase 3: Package data\n")
	sb.WriteString("echo \"Packaging data...\"\n")
	sb.WriteString("cd /freqtrade/user_data/data\n")
	sb.WriteString("tar -czf /tmp/data.tar.gz .\n\n")

	// Phase 4: Upload to S3 using Python
	sb.WriteString("# Phase 4: Upload to S3\n")
	sb.WriteString("echo \"Uploading to S3...\"\n")
	if verbose {
		sb.WriteString("echo \"UPLOAD_URL: $UPLOAD_URL\"\n")
	}
	sb.WriteString("python3 -c \"\n")
	sb.WriteString("import urllib.request\n")
	sb.WriteString("import os\n")
	sb.WriteString("url = os.environ['UPLOAD_URL']\n")
	if verbose {
		sb.WriteString("print(f'Uploading to: {url[:100]}...')\n")
	}
	sb.WriteString("with open('/tmp/data.tar.gz', 'rb') as f:\n")
	sb.WriteString("    data = f.read()\n")
	if verbose {
		sb.WriteString("print(f'Data size: {len(data)} bytes')\n")
	}
	sb.WriteString("req = urllib.request.Request(url, data=data, method='PUT')\n")
	sb.WriteString("req.add_header('Content-Type', 'application/gzip')\n")
	sb.WriteString("urllib.request.urlopen(req)\n")
	sb.WriteString("print('Upload completed')\n")
	sb.WriteString("\"\n\n")

	// Phase 5: Extract data metadata by scanning downloaded files
	sb.WriteString("# Phase 5: Extract available data metadata\n")
	sb.WriteString("echo \"Extracting data metadata...\"\n")
	sb.WriteString("python3 << 'METADATA_SCRIPT'\n")
	sb.WriteString(metadataScript)
	sb.WriteString("METADATA_SCRIPT\n\n")

	sb.WriteString("echo \"Data download and upload completed successfully!\"\n")

	return sb.String()
}

// metadataScript is the Python script that extracts data availability metadata.
const metadataScript = `import os
import json
import re
from datetime import datetime, timezone

data_dir = '/freqtrade/user_data/data'
result = {'exchanges': []}

# Scan data directory for exchanges
if os.path.isdir(data_dir):
    for exchange_name in sorted(os.listdir(data_dir)):
        exchange_path = os.path.join(data_dir, exchange_name)
        if not os.path.isdir(exchange_path):
            continue

        exchange_data = {'name': exchange_name, 'pairs': []}
        pairs_map = {}  # pair -> list of timeframe data

        # Scan exchange directory for data files
        # Freqtrade file formats:
        # - Spot: BTC_USDT-1h.json
        # - Futures: BTC_USDT_USDT-1h-futures.json (pair is BTC/USDT:USDT)
        for filename in os.listdir(exchange_path):
            if not filename.endswith('.json'):
                continue

            # Try to parse filename
            # Pattern 1: BASE_QUOTE-TIMEFRAME.json (spot)
            # Pattern 2: BASE_QUOTE_SETTLE-TIMEFRAME-futures.json (futures)
            basename = filename[:-5]  # remove .json

            # Check for futures format
            is_futures = '-futures' in basename or '-mark' in basename
            if is_futures:
                basename = re.sub(r'-(futures|mark)$', '', basename)

            # Split by last dash to get timeframe
            parts = basename.rsplit('-', 1)
            if len(parts) != 2:
                continue

            pair_part, timeframe = parts

            # Parse pair: BTC_USDT or BTC_USDT_USDT (futures with settlement)
            pair_parts = pair_part.split('_')
            if len(pair_parts) == 2:
                # Spot: BTC_USDT -> BTC/USDT
                pair = f'{pair_parts[0]}/{pair_parts[1]}'
            elif len(pair_parts) == 3:
                # Futures: BTC_USDT_USDT -> BTC/USDT:USDT
                pair = f'{pair_parts[0]}/{pair_parts[1]}:{pair_parts[2]}'
            else:
                continue

            # Get date range from file content (first and last candle)
            file_path = os.path.join(exchange_path, filename)
            from_date = None
            to_date = None
            try:
                with open(file_path, 'r') as f:
                    data = json.load(f)
                    if isinstance(data, list) and len(data) > 0:
                        # Freqtrade JSON format: [[timestamp, o, h, l, c, v], ...]
                        first_candle = data[0]
                        last_candle = data[-1]
                        from_ts = first_candle[0] / 1000  # ms to s
                        to_ts = last_candle[0] / 1000
                        from_date = datetime.fromtimestamp(from_ts, timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
                        to_date = datetime.fromtimestamp(to_ts, timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
            except Exception as e:
                print(f'Warning: Could not read {filename}: {e}', flush=True)

            if pair not in pairs_map:
                pairs_map[pair] = []

            # Avoid duplicates
            existing = [t for t in pairs_map[pair] if t['timeframe'] == timeframe]
            if not existing:
                pairs_map[pair].append({
                    'timeframe': timeframe,
                    'from': from_date,
                    'to': to_date
                })

        # Convert pairs map to list
        for pair, timeframes in sorted(pairs_map.items()):
            exchange_data['pairs'].append({
                'pair': pair,
                'timeframes': sorted(timeframes, key=lambda x: x['timeframe'])
            })

        if exchange_data['pairs']:
            result['exchanges'].append(exchange_data)

# Output with delimiters for parsing
print('===DATA_AVAILABLE_START===')
print(json.dumps(result))
print('===DATA_AVAILABLE_END===')
`
