package backtest

import (
	"fmt"
	"time"

	"github.com/matcornic/hermes/v2"
)

// hermesConfig returns the Hermes configuration for backtest alert emails.
func hermesConfig() hermes.Hermes {
	return hermes.Hermes{
		Theme: new(hermes.Default),
		Product: hermes.Product{
			Name:      "VolatiCloud",
			Link:      "https://volaticloud.com",
			Logo:      "https://volaticloud.com/logo.png",
			Copyright: "© VolatiCloud. All rights reserved.",
		},
	}
}

// CompletedTemplate generates email content for backtest completed alerts.
func CompletedTemplate(data map[string]interface{}) (subject, body, htmlBody string) {
	strategyName, _ := data["strategy_name"].(string)
	totalTrades, _ := data["total_trades"].(int)
	winRate, _ := data["win_rate"].(float64)
	profitTotal, _ := data["profit_total"].(float64)
	timestamp, _ := data["timestamp"].(time.Time)

	h := hermesConfig()

	subject = fmt.Sprintf("Backtest completed: %s (%.1f%% win rate)", strategyName, winRate*100)

	profitSign := "+"
	if profitTotal < 0 {
		profitSign = ""
	}

	email := hermes.Email{
		Body: hermes.Body{
			Title: "Backtest Completed",
			Intros: []string{
				fmt.Sprintf("Your backtest for strategy **%s** has completed successfully.", strategyName),
			},
			Dictionary: []hermes.Entry{
				{Key: "Strategy", Value: strategyName},
				{Key: "Total Trades", Value: fmt.Sprintf("%d", totalTrades)},
				{Key: "Win Rate", Value: fmt.Sprintf("%.1f%%", winRate*100)},
				{Key: "Total Profit", Value: fmt.Sprintf("%s%.2f%%", profitSign, profitTotal*100)},
				{Key: "Completed At", Value: timestamp.Format("2006-01-02 15:04:05 MST")},
			},
			Actions: []hermes.Action{
				{
					Instructions: "View detailed results in the dashboard:",
					Button: hermes.Button{
						Color: "#22BC66",
						Text:  "View Results",
						Link:  "https://volaticloud.com/backtests",
					},
				},
			},
			Outros: []string{
				"Review the full backtest report in the VolatiCloud dashboard for detailed metrics and trade analysis.",
			},
		},
	}

	htmlBody, _ = h.GenerateHTML(email)
	body, _ = h.GeneratePlainText(email)

	return subject, body, htmlBody
}

// FailedTemplate generates email content for backtest failed alerts.
func FailedTemplate(data map[string]interface{}) (subject, body, htmlBody string) {
	strategyName, _ := data["strategy_name"].(string)
	errorMessage, _ := data["error_message"].(string)
	timestamp, _ := data["timestamp"].(time.Time)

	h := hermesConfig()

	subject = fmt.Sprintf("Backtest failed: %s", strategyName)

	email := hermes.Email{
		Body: hermes.Body{
			Title: "Backtest Failed",
			Intros: []string{
				fmt.Sprintf("Your backtest for strategy **%s** has failed.", strategyName),
			},
			Dictionary: []hermes.Entry{
				{Key: "Strategy", Value: strategyName},
				{Key: "Error", Value: errorMessage},
				{Key: "Failed At", Value: timestamp.Format("2006-01-02 15:04:05 MST")},
			},
			Outros: []string{
				"Check the backtest logs in the VolatiCloud dashboard for more details.",
				"Common issues include: strategy syntax errors, insufficient historical data, or runner configuration problems.",
			},
		},
	}

	htmlBody, _ = h.GenerateHTML(email)
	body, _ = h.GeneratePlainText(email)

	return subject, body, htmlBody
}
