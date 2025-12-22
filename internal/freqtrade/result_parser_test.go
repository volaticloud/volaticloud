package freqtrade

import (
	"testing"
)

func TestParseResultFromJSON(t *testing.T) {
	tests := []struct {
		name    string
		data    []byte
		wantErr bool
	}{
		{
			name:    "valid JSON",
			data:    []byte(`{"strategy": {"TestStrategy": {"total_trades": 10}}}`),
			wantErr: false,
		},
		{
			name:    "empty JSON object",
			data:    []byte(`{}`),
			wantErr: false,
		},
		{
			name:    "invalid JSON",
			data:    []byte(`{invalid}`),
			wantErr: true,
		},
		{
			name:    "empty bytes",
			data:    []byte{},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseResultFromJSON(tt.data)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseResultFromJSON() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && result == nil {
				t.Error("ParseResultFromJSON() returned nil result for valid JSON")
			}
		})
	}
}

func TestParseResultFromLogs(t *testing.T) {
	tests := []struct {
		name    string
		logs    string
		wantErr bool
		wantRaw bool // whether we expect RawResult to be populated
	}{
		{
			name: "valid logs with markers",
			logs: `freqtrade 2024.11.2
Running backtest...
===BACKTEST_RESULT_JSON_START===
{"latest_backtest": "backtest-2024-01-01.zip"}
===BACKTEST_FULL_RESULT_START===
{"strategy": {"TestStrategy": {"total_trades": 10}}}
===BACKTEST_FULL_RESULT_END===
`,
			wantErr: false,
			wantRaw: true,
		},
		{
			name: "logs with only last_result marker",
			logs: `freqtrade 2024.11.2
===BACKTEST_RESULT_JSON_START===
{"latest_backtest": "backtest-2024-01-01.zip"}
`,
			wantErr: false,
			wantRaw: true,
		},
		{
			name:    "no markers in logs",
			logs:    "freqtrade 2024.11.2\nRunning...\n",
			wantErr: true,
			wantRaw: false,
		},
		{
			name:    "empty logs",
			logs:    "",
			wantErr: true,
			wantRaw: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseResultFromLogs(tt.logs)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseResultFromLogs() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && tt.wantRaw && result.RawResult == nil {
				t.Error("ParseResultFromLogs() expected RawResult but got nil")
			}
		})
	}
}

func TestContainsBacktestMarkers(t *testing.T) {
	tests := []struct {
		name string
		logs string
		want bool
	}{
		{
			name: "has result json start marker",
			logs: "some logs\n===BACKTEST_RESULT_JSON_START===\nmore",
			want: true,
		},
		{
			name: "has full result start marker",
			logs: "some logs\n===BACKTEST_FULL_RESULT_START===\nmore",
			want: true,
		},
		{
			name: "no markers",
			logs: "just some regular logs",
			want: false,
		},
		{
			name: "empty string",
			logs: "",
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ContainsBacktestMarkers(tt.logs); got != tt.want {
				t.Errorf("ContainsBacktestMarkers() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestExtractFreqtradeVersion(t *testing.T) {
	tests := []struct {
		name string
		logs string
		want string
	}{
		{
			name: "standard version",
			logs: "2024-01-01 - freqtrade 2024.11.2\nStarting...",
			want: "2024.11.2",
		},
		{
			name: "older version format",
			logs: "freqtrade 2023.5\n",
			want: "2023.5",
		},
		{
			name: "no version",
			logs: "Some other logs",
			want: "",
		},
		{
			name: "empty logs",
			logs: "",
			want: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ExtractFreqtradeVersion(tt.logs); got != tt.want {
				t.Errorf("ExtractFreqtradeVersion() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestExtractBetweenMarkers(t *testing.T) {
	tests := []struct {
		name        string
		text        string
		startMarker string
		endMarker   string
		want        string
	}{
		{
			name:        "content between markers",
			text:        "before===START===content===END===after",
			startMarker: "===START===",
			endMarker:   "===END===",
			want:        "content",
		},
		{
			name:        "no start marker",
			text:        "no markers here===END===",
			startMarker: "===START===",
			endMarker:   "===END===",
			want:        "",
		},
		{
			name:        "no end marker",
			text:        "===START===no end",
			startMarker: "===START===",
			endMarker:   "===END===",
			want:        "",
		},
		{
			name:        "empty string",
			text:        "",
			startMarker: "===START===",
			endMarker:   "===END===",
			want:        "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := extractBetweenMarkers(tt.text, tt.startMarker, tt.endMarker); got != tt.want {
				t.Errorf("extractBetweenMarkers() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestGetLatestBacktestFilename(t *testing.T) {
	tests := []struct {
		name       string
		lastResult map[string]interface{}
		want       string
		wantErr    bool
	}{
		{
			name: "valid latest_backtest",
			lastResult: map[string]interface{}{
				"latest_backtest": "backtest-result-2024-01-01.zip",
			},
			want:    "backtest-result-2024-01-01.zip",
			wantErr: false,
		},
		{
			name:       "missing latest_backtest",
			lastResult: map[string]interface{}{},
			want:       "",
			wantErr:    true,
		},
		{
			name: "wrong type",
			lastResult: map[string]interface{}{
				"latest_backtest": 123,
			},
			want:    "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := GetLatestBacktestFilename(tt.lastResult)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetLatestBacktestFilename() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("GetLatestBacktestFilename() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestExtractJSONFilenameFromZip(t *testing.T) {
	tests := []struct {
		name string
		zip  string
		want string
	}{
		{
			name: "standard zip",
			zip:  "backtest-result-2024-01-01.zip",
			want: "backtest-result-2024-01-01.json",
		},
		{
			name: "no zip extension",
			zip:  "backtest-result",
			want: "backtest-result",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ExtractJSONFilenameFromZip(tt.zip); got != tt.want {
				t.Errorf("ExtractJSONFilenameFromZip() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestValidateBacktestResult(t *testing.T) {
	tests := []struct {
		name    string
		result  map[string]interface{}
		wantErr bool
	}{
		{
			name: "valid result",
			result: map[string]interface{}{
				"strategy": map[string]interface{}{
					"TestStrategy": map[string]interface{}{},
				},
			},
			wantErr: false,
		},
		{
			name:    "missing strategy",
			result:  map[string]interface{}{},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := ValidateBacktestResult(tt.result); (err != nil) != tt.wantErr {
				t.Errorf("ValidateBacktestResult() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestCleanLogs(t *testing.T) {
	tests := []struct {
		name string
		logs string
		want string
	}{
		{
			name: "logs with all markers",
			logs: `2024-01-01 - freqtrade 2024.11.2
Loading config...
Running backtest...
Results: 10 trades
===BACKTEST_RESULT_JSON_START===
{"latest_backtest": "result.zip"}
===BACKTEST_FULL_RESULT_START===
{"strategy": {"Test": {}}}
===BACKTEST_FULL_RESULT_END===
`,
			want: `2024-01-01 - freqtrade 2024.11.2
Loading config...
Running backtest...
Results: 10 trades`,
		},
		{
			name: "logs without markers",
			logs: `2024-01-01 - freqtrade 2024.11.2
Loading config...
Running backtest...
`,
			want: `2024-01-01 - freqtrade 2024.11.2
Loading config...
Running backtest...`,
		},
		{
			name: "empty logs",
			logs: "",
			want: "",
		},
		{
			name: "logs with only result json marker",
			logs: `freqtrade running
===BACKTEST_RESULT_JSON_START===
{"latest_backtest": "result.zip"}
`,
			want: "freqtrade running",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CleanLogs(tt.logs)
			if got != tt.want {
				t.Errorf("CleanLogs() = %q, want %q", got, tt.want)
			}
		})
	}
}
