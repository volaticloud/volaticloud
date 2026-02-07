package runner

import (
	"strings"
	"testing"
)

func TestShellEscape(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "simple string",
			input:    "BTC/USDT",
			expected: "'BTC/USDT'",
		},
		{
			name:     "string with spaces",
			input:    "hello world",
			expected: "'hello world'",
		},
		{
			name:     "string with single quote",
			input:    "it's",
			expected: `'it'\''s'`,
		},
		{
			name:     "string with multiple single quotes",
			input:    "it's a 'test'",
			expected: `'it'\''s a '\''test'\'''`,
		},
		{
			name:     "string with double quotes",
			input:    `"hello"`,
			expected: `'"hello"'`,
		},
		{
			name:     "shell injection attempt",
			input:    `"; rm -rf / #`,
			expected: `'"; rm -rf / #'`,
		},
		{
			name:     "command substitution attempt",
			input:    "$(whoami)",
			expected: "'$(whoami)'",
		},
		{
			name:     "backtick substitution attempt",
			input:    "`whoami`",
			expected: "'`whoami`'",
		},
		{
			name:     "pipe and redirect",
			input:    "test | cat > /etc/passwd",
			expected: "'test | cat > /etc/passwd'",
		},
		{
			name:     "empty string",
			input:    "",
			expected: "''",
		},
		{
			name:     "regex pattern",
			input:    ".*/USDT",
			expected: "'.*/USDT'",
		},
		{
			name:     "complex pattern with parentheses",
			input:    "(BTC|ETH)/USDT",
			expected: "'(BTC|ETH)/USDT'",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ShellEscape(tt.input)
			if result != tt.expected {
				t.Errorf("ShellEscape(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestBuildDownloadScript(t *testing.T) {
	tests := []struct {
		name        string
		spec        DataDownloadSpec
		verbose     bool
		wantContain []string
		wantExclude []string
	}{
		{
			name: "basic single exchange",
			spec: DataDownloadSpec{
				RunnerID:       "test-runner",
				UploadURL:      "https://s3.example.com/upload",
				FreqtradeImage: "freqtradeorg/freqtrade:stable",
				ExchangeConfigs: []ExchangeDownloadConfig{
					{
						Name:         "binance",
						PairsPattern: "BTC/USDT",
						Timeframes:   []string{"1h", "4h"},
						Days:         7,
						TradingMode:  "spot",
					},
				},
			},
			verbose: false,
			wantContain: []string{
				"set -e",
				"freqtrade download-data",
				"--exchange 'binance'",
				"--pairs 'BTC/USDT'",
				"--timeframes '1h' '4h'",
				"--days 7",
				"--trading-mode 'spot'",
				"tar -czf /tmp/data.tar.gz",
				"Upload completed",
			},
			wantExclude: []string{
				"UPLOAD_URL:", // Verbose output
			},
		},
		{
			name: "verbose mode shows debug output",
			spec: DataDownloadSpec{
				RunnerID:       "test-runner",
				UploadURL:      "https://s3.example.com/upload",
				FreqtradeImage: "freqtradeorg/freqtrade:stable",
				ExchangeConfigs: []ExchangeDownloadConfig{
					{
						Name:         "okx",
						PairsPattern: "ETH/USDT",
						Timeframes:   []string{"15m"},
						Days:         3,
						TradingMode:  "futures",
					},
				},
			},
			verbose: true,
			wantContain: []string{
				"echo \"UPLOAD_URL: $UPLOAD_URL\"",
				"Uploading to:",
				"Data size:",
			},
		},
		{
			name: "multiple exchanges",
			spec: DataDownloadSpec{
				RunnerID:       "test-runner",
				UploadURL:      "https://s3.example.com/upload",
				FreqtradeImage: "freqtradeorg/freqtrade:stable",
				ExchangeConfigs: []ExchangeDownloadConfig{
					{
						Name:         "binance",
						PairsPattern: "BTC/USDT",
						Timeframes:   []string{"1h"},
						Days:         7,
						TradingMode:  "spot",
					},
					{
						Name:         "okx",
						PairsPattern: "ETH/USDT",
						Timeframes:   []string{"4h"},
						Days:         14,
						TradingMode:  "futures",
					},
				},
			},
			verbose: false,
			wantContain: []string{
				"Downloading binance data",
				"--exchange 'binance'",
				"Downloading okx data",
				"--exchange 'okx'",
			},
		},
		{
			name: "shell injection in exchange name is escaped",
			spec: DataDownloadSpec{
				RunnerID:       "test-runner",
				UploadURL:      "https://s3.example.com/upload",
				FreqtradeImage: "freqtradeorg/freqtrade:stable",
				ExchangeConfigs: []ExchangeDownloadConfig{
					{
						Name:         "'; rm -rf / #",
						PairsPattern: "BTC/USDT",
						Timeframes:   []string{"1h"},
						Days:         7,
						TradingMode:  "spot",
					},
				},
			},
			verbose: false,
			wantContain: []string{
				// The malicious exchange name should be escaped with single quotes
				// Input: '; rm -rf / # → Output: ''\''; rm -rf / #'
				// The single quote is escaped as '\'' (end quote, escaped quote, start quote)
				"--exchange ''\\''; rm -rf / #'",
			},
			wantExclude: []string{
				// The unescaped version should NOT appear
				"--exchange '; rm -rf / #",
			},
		},
		{
			name: "command substitution in pairs is escaped",
			spec: DataDownloadSpec{
				RunnerID:       "test-runner",
				UploadURL:      "https://s3.example.com/upload",
				FreqtradeImage: "freqtradeorg/freqtrade:stable",
				ExchangeConfigs: []ExchangeDownloadConfig{
					{
						Name:         "binance",
						PairsPattern: "$(whoami)/USDT",
						Timeframes:   []string{"1h"},
						Days:         7,
						TradingMode:  "spot",
					},
				},
			},
			verbose: false,
			wantContain: []string{
				// Command substitution should be quoted and not executed
				"--pairs '$(whoami)/USDT'",
			},
		},
		{
			name: "regex pattern in pairs is preserved",
			spec: DataDownloadSpec{
				RunnerID:       "test-runner",
				UploadURL:      "https://s3.example.com/upload",
				FreqtradeImage: "freqtradeorg/freqtrade:stable",
				ExchangeConfigs: []ExchangeDownloadConfig{
					{
						Name:         "binance",
						PairsPattern: ".*/USDT:USDT",
						Timeframes:   []string{"1h", "4h", "1d"},
						Days:         30,
						TradingMode:  "futures",
					},
				},
			},
			verbose: false,
			wantContain: []string{
				"--pairs '.*/USDT:USDT'",
				"--timeframes '1h' '4h' '1d'",
				"--trading-mode 'futures'",
			},
		},
		{
			name: "existing data URL triggers download phase",
			spec: DataDownloadSpec{
				RunnerID:        "test-runner",
				ExistingDataURL: "https://s3.example.com/existing.tar.gz",
				UploadURL:       "https://s3.example.com/upload",
				FreqtradeImage:  "freqtradeorg/freqtrade:stable",
				ExchangeConfigs: []ExchangeDownloadConfig{
					{
						Name:         "binance",
						PairsPattern: "BTC/USDT",
						Timeframes:   []string{"1h"},
						Days:         7,
						TradingMode:  "spot",
					},
				},
			},
			verbose: false,
			wantContain: []string{
				"Download existing data for incremental update",
				"EXISTING_DATA_URL",
				"existing.tar.gz",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			script := BuildDownloadScript(tt.spec, tt.verbose)

			for _, want := range tt.wantContain {
				if !strings.Contains(script, want) {
					t.Errorf("BuildDownloadScript() missing expected content: %q\n\nScript:\n%s", want, script)
				}
			}

			for _, notWant := range tt.wantExclude {
				if strings.Contains(script, notWant) {
					t.Errorf("BuildDownloadScript() contains unexpected content: %q\n\nScript:\n%s", notWant, script)
				}
			}
		})
	}
}

func TestBuildDownloadScript_ScriptStructure(t *testing.T) {
	spec := DataDownloadSpec{
		RunnerID:       "test-runner",
		UploadURL:      "https://s3.example.com/upload",
		FreqtradeImage: "freqtradeorg/freqtrade:stable",
		ExchangeConfigs: []ExchangeDownloadConfig{
			{
				Name:         "binance",
				PairsPattern: "BTC/USDT",
				Timeframes:   []string{"1h"},
				Days:         7,
				TradingMode:  "spot",
			},
		},
	}

	script := BuildDownloadScript(spec, false)

	// Script should start with set -e for error handling
	if !strings.HasPrefix(script, "set -e") {
		t.Error("Script should start with 'set -e' for proper error handling")
	}

	// Script should have all 5 phases
	phases := []string{
		"Phase 1: Download existing data",
		"Phase 2: Download new data",
		"Phase 3: Package data",
		"Phase 4: Upload to S3",
		"Phase 5: Extract available data metadata",
	}

	for _, phase := range phases {
		if !strings.Contains(script, phase) {
			t.Errorf("Script missing phase: %q", phase)
		}
	}

	// Script should end with success message
	if !strings.Contains(script, "Data download and upload completed successfully") {
		t.Error("Script should end with success message")
	}
}
