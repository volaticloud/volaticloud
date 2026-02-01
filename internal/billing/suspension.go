package billing

import (
	"context"
	"log"
	"strings"

	"volaticloud/internal/ent"
	"volaticloud/internal/ent/bot"
	"volaticloud/internal/enum"
	"volaticloud/internal/runner"
)

// StopOrgBots stops all running/starting bots for a suspended organization.
// This is best-effort: individual bot stop failures are logged but do not fail the operation.
func StopOrgBots(ctx context.Context, client *ent.Client, ownerID string) {
	bots, err := client.Bot.Query().
		Where(
			bot.OwnerID(ownerID),
			bot.StatusIn(enum.BotStatusRunning, enum.BotStatusCreating),
		).
		WithRunner().
		All(ctx)
	if err != nil {
		log.Printf("[BILLING] action=stop_org_bots owner=%s error=%v", ownerID, err)
		return
	}

	if len(bots) == 0 {
		return
	}

	log.Printf("[BILLING] action=stop_org_bots owner=%s bot_count=%d", ownerID, len(bots))

	factory := runner.NewFactory()

	for _, b := range bots {
		botRunner := b.Edges.Runner
		if botRunner == nil {
			log.Printf("[BILLING] action=stop_bot_skip bot=%s reason=no_runner", b.ID)
			continue
		}

		rt, err := factory.Create(ctx, botRunner.Type, botRunner.Config)
		if err != nil {
			log.Printf("[BILLING] action=stop_bot_fail bot=%s error=%v", b.ID, err)
			continue
		}

		if err := rt.StopBot(ctx, b.ID.String()); err != nil {
			if !strings.Contains(err.Error(), "not found") && !strings.Contains(err.Error(), "No such container") {
				log.Printf("[BILLING] action=stop_bot_fail bot=%s error=%v", b.ID, err)
			}
		}

		if err := rt.DeleteBot(ctx, b.ID.String()); err != nil {
			log.Printf("[BILLING] action=delete_bot_fail bot=%s error=%v", b.ID, err)
		}

		rt.Close()

		if _, err := client.Bot.UpdateOneID(b.ID).
			SetStatus(enum.BotStatusStopped).
			Save(ctx); err != nil {
			log.Printf("[BILLING] action=update_bot_status_fail bot=%s error=%v", b.ID, err)
		} else {
			log.Printf("[BILLING] action=stop_bot_success bot=%s owner=%s reason=suspension", b.ID, ownerID)
		}
	}
}
