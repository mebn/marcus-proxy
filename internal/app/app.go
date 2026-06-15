package app

import (
	"context"
	"time"

	captureproxy "marcus-proxy/internal/proxy"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx   context.Context
	proxy *captureproxy.Server
}

func NewApp() *App {
	return &App{}
}

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	a.proxy = captureproxy.NewServer(func(entry captureproxy.TrafficEntry) {
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "traffic:new", entry)
		}
	})
	_, _ = a.proxy.Start(captureproxy.DefaultAddress)
}

func (a *App) Shutdown(ctx context.Context) {
	if a.proxy == nil {
		return
	}
	shutdownCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	_ = a.proxy.Stop(shutdownCtx)
}

func (a *App) StartProxy() (captureproxy.Status, error) {
	if a.proxy == nil {
		a.proxy = captureproxy.NewServer(nil)
	}
	return a.proxy.Start(captureproxy.DefaultAddress)
}

func (a *App) StopProxy() error {
	if a.proxy == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	return a.proxy.Stop(ctx)
}

func (a *App) GetProxyStatus() captureproxy.Status {
	if a.proxy == nil {
		return captureproxy.Status{}
	}
	return a.proxy.Status()
}
