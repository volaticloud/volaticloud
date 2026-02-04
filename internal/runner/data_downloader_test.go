package runner

import "testing"

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
