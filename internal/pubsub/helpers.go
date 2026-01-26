package pubsub

import (
	"log"
)

// RecoverSubscription is a deferred function for subscription goroutines.
// It recovers from panics and logs them without crashing the server.
//
// Usage:
//
//	go func() {
//	    defer pubsub.RecoverSubscription("BotStatusChanged", unsub, botCh)
//	    // ... subscription logic
//	}()
func RecoverSubscription[T any](name string, unsub func(), ch chan T) {
	if r := recover(); r != nil {
		log.Printf("subscription panic recovered in %s: %v", name, r)
	}
	close(ch)
	if unsub != nil {
		unsub()
	}
}

// RecoverWithCleanup is a more flexible panic recovery helper that
// accepts custom cleanup functions.
//
// Usage:
//
//	go func() {
//	    defer pubsub.RecoverWithCleanup("MySubscription", func() {
//	        close(ch)
//	        unsub()
//	        // additional cleanup...
//	    })
//	    // ... subscription logic
//	}()
func RecoverWithCleanup(name string, cleanup func()) {
	if r := recover(); r != nil {
		log.Printf("subscription panic recovered in %s: %v", name, r)
	}
	if cleanup != nil {
		cleanup()
	}
}
