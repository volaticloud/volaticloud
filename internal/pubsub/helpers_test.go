package pubsub

import (
	"sync"
	"testing"
	"time"
)

func TestRecoverSubscription_NoPanic(t *testing.T) {
	ch := make(chan int)
	unsubCalled := false
	unsub := func() { unsubCalled = true }

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		defer RecoverSubscription("TestSubscription", unsub, ch)
		// No panic, just return
	}()

	wg.Wait()

	// Channel should be closed
	select {
	case _, ok := <-ch:
		if ok {
			t.Error("Expected channel to be closed")
		}
	default:
		t.Error("Expected channel to be closed, but it's not")
	}

	// Unsub should be called
	if !unsubCalled {
		t.Error("Expected unsub to be called")
	}
}

func TestRecoverSubscription_WithPanic(t *testing.T) {
	ch := make(chan int)
	unsubCalled := false
	unsub := func() { unsubCalled = true }

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		defer RecoverSubscription("TestSubscription", unsub, ch)
		panic("test panic")
	}()

	wg.Wait()

	// Channel should be closed
	select {
	case _, ok := <-ch:
		if ok {
			t.Error("Expected channel to be closed")
		}
	default:
		t.Error("Expected channel to be closed, but it's not")
	}

	// Unsub should be called even after panic
	if !unsubCalled {
		t.Error("Expected unsub to be called after panic")
	}
}

func TestRecoverSubscription_NilUnsub(t *testing.T) {
	ch := make(chan int)

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		defer RecoverSubscription("TestSubscription", nil, ch)
		// No panic
	}()

	wg.Wait()

	// Channel should be closed
	select {
	case _, ok := <-ch:
		if ok {
			t.Error("Expected channel to be closed")
		}
	default:
		t.Error("Expected channel to be closed, but it's not")
	}
}

func TestRecoverWithCleanup_NoPanic(t *testing.T) {
	cleanupCalled := false

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		defer RecoverWithCleanup("TestSubscription", func() {
			cleanupCalled = true
		})
		// No panic
	}()

	wg.Wait()

	if !cleanupCalled {
		t.Error("Expected cleanup to be called")
	}
}

func TestRecoverWithCleanup_WithPanic(t *testing.T) {
	cleanupCalled := false

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		defer RecoverWithCleanup("TestSubscription", func() {
			cleanupCalled = true
		})
		panic("test panic")
	}()

	wg.Wait()

	if !cleanupCalled {
		t.Error("Expected cleanup to be called after panic")
	}
}

func TestRecoverWithCleanup_NilCleanup(t *testing.T) {
	// This should not panic
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		defer RecoverWithCleanup("TestSubscription", nil)
		// No panic
	}()

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		// Success
	case <-time.After(time.Second):
		t.Error("Test timed out - nil cleanup may have caused issue")
	}
}

func TestRecoverWithCleanup_MultipleResources(t *testing.T) {
	ch1 := make(chan int)
	ch2 := make(chan string)
	unsubCalled := false

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		defer RecoverWithCleanup("TestSubscription", func() {
			close(ch1)
			close(ch2)
			unsubCalled = true
		})
		panic("test panic")
	}()

	wg.Wait()

	// Both channels should be closed
	select {
	case _, ok := <-ch1:
		if ok {
			t.Error("Expected ch1 to be closed")
		}
	default:
		t.Error("Expected ch1 to be closed, but it's not")
	}

	select {
	case _, ok := <-ch2:
		if ok {
			t.Error("Expected ch2 to be closed")
		}
	default:
		t.Error("Expected ch2 to be closed, but it's not")
	}

	if !unsubCalled {
		t.Error("Expected unsub to be called")
	}
}
