package app

import (
	"context"
	"time"

	captureproxy "marcus-proxy/internal/proxy"
	"marcus-proxy/internal/storage"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx   context.Context
	proxy *captureproxy.Server
	store *storage.Store
}

func NewApp() *App {
	return &App{}
}

func (a *App) Menu() *menu.Menu {
	viewMenu := menu.NewMenu()
	viewMenu.AddCheckbox("Dark Mode", true, nil, func(data *menu.CallbackData) {
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "theme:dark-mode", data.MenuItem.Checked)
		}
	})
	viewMenu.AddCheckbox("Show Request Info on Right", false, nil, func(data *menu.CallbackData) {
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "request-info-panel:placement", data.MenuItem.Checked)
		}
	})

	certificateMenu := menu.NewMenu()
	certificateMenu.AddText("Generate New Certificate", nil, func(_ *menu.CallbackData) {
		_, _ = a.GenerateNewCertificate()
	})

	return menu.NewMenuFromItems(
		menu.AppMenu(),
		menu.EditMenu(),
		menu.SubMenu("Certificate", certificateMenu),
		menu.SubMenu("View", viewMenu),
		menu.WindowMenu(),
	)
}

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	store, err := storage.Open()
	if err == nil {
		a.store = store
	}
	a.proxy = a.newProxy()
	if a.store != nil {
		if entries, err := a.store.LoadTrafficEntries(); err == nil {
			a.proxy.SetTraffic(entries)
		}
	}
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
		a.proxy = a.newProxy()
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

func (a *App) LoadAppState() (storage.AppState, error) {
	if a.store == nil {
		store, err := storage.Open()
		if err != nil {
			return storage.AppState{}, err
		}
		a.store = store
	}
	return a.store.LoadAppState()
}

func (a *App) SaveAppState(state storage.AppState) error {
	if a.store == nil {
		store, err := storage.Open()
		if err != nil {
			return err
		}
		a.store = store
	}
	return a.store.SaveAppState(state)
}

func (a *App) GenerateNewCertificate() (captureproxy.Status, error) {
	if a.proxy == nil {
		a.proxy = a.newProxy()
	}

	status, err := a.proxy.RegenerateAuthority()
	if err != nil {
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "certificate:error", err.Error())
		}
		return captureproxy.Status{}, err
	}
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "certificate:regenerated", status)
	}
	return status, nil
}

func (a *App) newProxy() *captureproxy.Server {
	return captureproxy.NewServer(func(entry captureproxy.TrafficEntry) {
		if a.store != nil {
			go func() {
				_ = a.store.SaveTrafficEntry(entry)
			}()
		}
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "traffic:new", entry)
		}
	})
}
