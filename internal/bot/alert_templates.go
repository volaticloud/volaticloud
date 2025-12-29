package bot

import (
	"fmt"
	"strings"
	"time"

	"github.com/matcornic/hermes/v2"
)

// hermesConfig returns the Hermes configuration for bot alert emails.
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

// TradeOpenedTemplate generates email content for trade opened alerts.
func TradeOpenedTemplate(data map[string]interface{}) (subject, body, htmlBody string) {
	botName, _ := data["bot_name"].(string)
	botMode, _ := data["bot_mode"].(string)
	tradeCount, _ := data["trade_count"].(int)
	trades, _ := data["trades"].([]map[string]interface{})
	timestamp, _ := data["timestamp"].(time.Time)

	h := hermesConfig()

	// Build trades table
	tableData := make([][]hermes.Entry, 0, len(trades))
	var totalStake float64
	var pairs []string

	for _, t := range trades {
		pair, _ := t["pair"].(string)
		stakeAmount, _ := t["stake_amount"].(float64)
		openRate, _ := t["open_rate"].(float64)
		strategy, _ := t["strategy"].(string)

		totalStake += stakeAmount
		pairs = append(pairs, pair)

		tableData = append(tableData, []hermes.Entry{
			{Key: "Pair", Value: pair},
			{Key: "Stake", Value: fmt.Sprintf("%.2f USDT", stakeAmount)},
			{Key: "Rate", Value: fmt.Sprintf("%.4f", openRate)},
			{Key: "Strategy", Value: strategy},
		})
	}

	// Build subject
	if tradeCount == 1 && len(pairs) > 0 {
		subject = fmt.Sprintf("%s: opened %s (%.2f USDT)", botName, pairs[0], totalStake)
	} else {
		subject = fmt.Sprintf("%s: opened %d trades (%.2f USDT)", botName, tradeCount, totalStake)
	}

	// Build email
	email := hermes.Email{
		Body: hermes.Body{
			Title: "New Trade(s) Opened",
			Intros: []string{
				fmt.Sprintf("Your bot **%s** (%s) has opened %d new trade(s).", botName, botMode, tradeCount),
			},
			Table: hermes.Table{
				Data: tableData,
				Columns: hermes.Columns{
					CustomWidth: map[string]string{
						"Pair":     "25%",
						"Stake":    "25%",
						"Rate":     "25%",
						"Strategy": "25%",
					},
				},
			},
			Dictionary: []hermes.Entry{
				{Key: "Total Stake", Value: fmt.Sprintf("%.2f USDT", totalStake)},
				{Key: "Time", Value: timestamp.Format("2006-01-02 15:04:05 MST")},
			},
			Outros: []string{
				"Monitor your trades in the VolatiCloud dashboard.",
			},
		},
	}

	htmlBody, _ = h.GenerateHTML(email)
	body, _ = h.GeneratePlainText(email)

	return subject, body, htmlBody
}

// TradeClosedTemplate generates email content for trade closed alerts.
func TradeClosedTemplate(data map[string]interface{}) (subject, body, htmlBody string) {
	botName, _ := data["bot_name"].(string)
	botMode, _ := data["bot_mode"].(string)
	tradeCount, _ := data["trade_count"].(int)
	trades, _ := data["trades"].([]map[string]interface{})
	totalProfitAbs, _ := data["total_profit_abs"].(float64)
	totalProfitRatio, _ := data["total_profit_ratio"].(float64)
	timestamp, _ := data["timestamp"].(time.Time)

	h := hermesConfig()

	// Build trades table
	tableData := make([][]hermes.Entry, 0, len(trades))
	var pairs []string

	for _, t := range trades {
		pair, _ := t["pair"].(string)
		profitAbs, _ := t["profit_abs"].(float64)
		profitRatio, _ := t["profit_ratio"].(float64)
		exitReason, _ := t["exit_reason"].(string)

		pairs = append(pairs, pair)

		profitSign := "+"
		if profitAbs < 0 {
			profitSign = ""
		}

		tableData = append(tableData, []hermes.Entry{
			{Key: "Pair", Value: pair},
			{Key: "Profit", Value: fmt.Sprintf("%s%.2f USDT", profitSign, profitAbs)},
			{Key: "Return", Value: fmt.Sprintf("%s%.2f%%", profitSign, profitRatio*100)},
			{Key: "Exit Reason", Value: exitReason},
		})
	}

	// Build subject
	profitSign := "+"
	if totalProfitAbs < 0 {
		profitSign = ""
	}

	if tradeCount == 1 && len(pairs) > 0 {
		subject = fmt.Sprintf("%s: closed %s (%s%.2f%%, %s%.2f USDT)",
			botName, pairs[0], profitSign, totalProfitRatio*100, profitSign, totalProfitAbs)
	} else {
		subject = fmt.Sprintf("%s: closed %d trades (%s%.2f%%, %s%.2f USDT)",
			botName, tradeCount, profitSign, totalProfitRatio*100, profitSign, totalProfitAbs)
	}

	// Determine intro message based on profit
	introMsg := fmt.Sprintf("Your bot **%s** (%s) has closed %d trade(s).", botName, botMode, tradeCount)
	if totalProfitAbs >= 0 {
		introMsg += fmt.Sprintf(" Total profit: **+%.2f USDT** (+%.2f%%)", totalProfitAbs, totalProfitRatio*100)
	} else {
		introMsg += fmt.Sprintf(" Total loss: **%.2f USDT** (%.2f%%)", totalProfitAbs, totalProfitRatio*100)
	}

	// Build email
	email := hermes.Email{
		Body: hermes.Body{
			Title: "Trade(s) Closed",
			Intros: []string{
				introMsg,
			},
			Table: hermes.Table{
				Data: tableData,
				Columns: hermes.Columns{
					CustomWidth: map[string]string{
						"Pair":        "25%",
						"Profit":      "25%",
						"Return":      "20%",
						"Exit Reason": "30%",
					},
				},
			},
			Dictionary: []hermes.Entry{
				{Key: "Total Profit", Value: fmt.Sprintf("%s%.2f USDT (%s%.2f%%)", profitSign, totalProfitAbs, profitSign, totalProfitRatio*100)},
				{Key: "Time", Value: timestamp.Format("2006-01-02 15:04:05 MST")},
			},
			Outros: []string{
				"View detailed trade history in the VolatiCloud dashboard.",
			},
		},
	}

	htmlBody, _ = h.GenerateHTML(email)
	body, _ = h.GeneratePlainText(email)

	return subject, body, htmlBody
}

// LargeProfitLossTemplate generates email content for large profit/loss alerts.
func LargeProfitLossTemplate(data map[string]interface{}) (subject, body, htmlBody string) {
	botName, _ := data["bot_name"].(string)
	pair, _ := data["pair"].(string)
	profitAbs, _ := data["profit_abs"].(float64)
	profitRatio, _ := data["profit_ratio"].(float64)
	openRate, _ := data["open_rate"].(float64)
	closeRate, _ := data["close_rate"].(float64)
	exitReason, _ := data["exit_reason"].(string)
	timestamp, _ := data["timestamp"].(time.Time)

	h := hermesConfig()

	direction := "Profit"
	if profitRatio < 0 {
		direction = "Loss"
	}

	profitSign := "+"
	if profitAbs < 0 {
		profitSign = ""
	}

	subject = fmt.Sprintf("Large %s on %s: %s%.2f%% (%s%.2f USDT)",
		strings.ToLower(direction), pair, profitSign, profitRatio*100, profitSign, profitAbs)

	email := hermes.Email{
		Body: hermes.Body{
			Title: fmt.Sprintf("Large %s Alert", direction),
			Intros: []string{
				fmt.Sprintf("A significant %s has been recorded on your bot **%s**.", strings.ToLower(direction), botName),
			},
			Dictionary: []hermes.Entry{
				{Key: "Pair", Value: pair},
				{Key: direction, Value: fmt.Sprintf("%s%.2f USDT (%s%.2f%%)", profitSign, profitAbs, profitSign, profitRatio*100)},
				{Key: "Open Rate", Value: fmt.Sprintf("%.4f", openRate)},
				{Key: "Close Rate", Value: fmt.Sprintf("%.4f", closeRate)},
				{Key: "Exit Reason", Value: exitReason},
				{Key: "Time", Value: timestamp.Format("2006-01-02 15:04:05 MST")},
			},
			Outros: []string{
				"Review your bot's performance in the VolatiCloud dashboard.",
			},
		},
	}

	htmlBody, _ = h.GenerateHTML(email)
	body, _ = h.GeneratePlainText(email)

	return subject, body, htmlBody
}

// StatusChangeTemplate generates email content for bot status change alerts.
func StatusChangeTemplate(data map[string]interface{}) (subject, body, htmlBody string) {
	botName, _ := data["bot_name"].(string)
	oldStatus, _ := data["old_status"].(string)
	newStatus, _ := data["new_status"].(string)
	errorMessage, _ := data["error_message"].(string)
	botMode, _ := data["bot_mode"].(string)
	timestamp, _ := data["timestamp"].(time.Time)

	h := hermesConfig()

	subject = fmt.Sprintf("%s: status changed to %s", botName, newStatus)

	intros := []string{
		fmt.Sprintf("Your bot **%s** (%s) status has changed from **%s** to **%s**.", botName, botMode, oldStatus, newStatus),
	}

	dictionary := []hermes.Entry{
		{Key: "Bot", Value: botName},
		{Key: "Previous Status", Value: oldStatus},
		{Key: "Current Status", Value: newStatus},
		{Key: "Time", Value: timestamp.Format("2006-01-02 15:04:05 MST")},
	}

	if errorMessage != "" {
		intros = append(intros, fmt.Sprintf("Error: %s", errorMessage))
		dictionary = append(dictionary, hermes.Entry{Key: "Error", Value: errorMessage})
	}

	email := hermes.Email{
		Body: hermes.Body{
			Title:      "Bot Status Changed",
			Intros:     intros,
			Dictionary: dictionary,
			Outros: []string{
				"Check your bot's status in the VolatiCloud dashboard.",
			},
		},
	}

	htmlBody, _ = h.GenerateHTML(email)
	body, _ = h.GeneratePlainText(email)

	return subject, body, htmlBody
}

// ConnectionIssueTemplate generates email content for connection issue alerts.
func ConnectionIssueTemplate(data map[string]interface{}) (subject, body, htmlBody string) {
	botName, _ := data["bot_name"].(string)
	errorMessage, _ := data["error_message"].(string)
	retryCount, _ := data["retry_count"].(int)
	botMode, _ := data["bot_mode"].(string)
	timestamp, _ := data["timestamp"].(time.Time)

	h := hermesConfig()

	subject = fmt.Sprintf("%s: connection issue detected", botName)

	email := hermes.Email{
		Body: hermes.Body{
			Title: "Connection Issue Detected",
			Intros: []string{
				fmt.Sprintf("Your bot **%s** (%s) is experiencing connection issues.", botName, botMode),
			},
			Dictionary: []hermes.Entry{
				{Key: "Bot", Value: botName},
				{Key: "Error", Value: errorMessage},
				{Key: "Retry Count", Value: fmt.Sprintf("%d", retryCount)},
				{Key: "Time", Value: timestamp.Format("2006-01-02 15:04:05 MST")},
			},
			Outros: []string{
				"The system will automatically attempt to reconnect. If issues persist, check your runner and exchange configurations.",
			},
		},
	}

	htmlBody, _ = h.GenerateHTML(email)
	body, _ = h.GeneratePlainText(email)

	return subject, body, htmlBody
}
