package proxy

import (
	"context"
	"errors"
	"net"
	"net/http"
	"time"
)

func (s *Server) Start(address string) (Status, error) {
	if address == "" {
		address = DefaultAddress
	}

	s.mu.Lock()
	if s.server != nil {
		status := s.statusLocked()
		s.mu.Unlock()
		return status, nil
	}
	s.mu.Unlock()

	authority, err := LoadOrCreateAuthority()
	if err != nil {
		return Status{}, err
	}
	listener, err := net.Listen("tcp", address)
	if err != nil {
		return Status{}, err
	}

	server := &http.Server{Handler: s, ReadHeaderTimeout: 10 * time.Second}
	s.mu.Lock()
	s.listener = listener
	s.server = server
	s.authority = authority
	status := s.statusLocked()
	s.mu.Unlock()

	go s.serve(server, listener, address)
	return status, nil
}

func (s *Server) serve(server *http.Server, listener net.Listener, address string) {
	err := server.Serve(listener)
	if err == nil || errors.Is(err, http.ErrServerClosed) {
		return
	}
	s.record(TrafficEntry{
		Method: "SERVER",
		URL:    address,
		Host:   address,
		Error:  err.Error(),
		Time:   time.Now().Format(time.RFC3339),
	})
}

func (s *Server) Stop(ctx context.Context) error {
	s.mu.Lock()
	server := s.server
	s.server = nil
	s.listener = nil
	s.mu.Unlock()

	if server == nil {
		return nil
	}
	return server.Shutdown(ctx)
}

func (s *Server) Status() Status {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.statusLocked()
}

func (s *Server) SetTraffic(entries []TrafficEntry) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.traffic = append([]TrafficEntry(nil), entries...)
	s.nextID = maxTrafficID(entries)
}

func (s *Server) RegenerateAuthority() (Status, error) {
	authority, err := RegenerateAuthority()
	if err != nil {
		return Status{}, err
	}

	s.mu.Lock()
	s.authority = authority
	status := s.statusLocked()
	s.mu.Unlock()
	return status, nil
}

func (s *Server) ServeHTTP(rw http.ResponseWriter, req *http.Request) {
	start := time.Now()
	if req.Method == http.MethodConnect {
		s.handleConnect(rw, req, start)
		return
	}
	s.handleHTTP(rw, req, start)
}

func (s *Server) record(entry TrafficEntry) {
	s.mu.Lock()
	s.nextID++
	entry.ID = s.nextID
	if entry.Time == "" {
		entry.Time = time.Now().Format(time.RFC3339)
	}
	s.traffic = append([]TrafficEntry{entry}, s.traffic...)
	recorder := s.onRecord
	s.mu.Unlock()

	if recorder != nil {
		recorder(entry)
	}
}

func (s *Server) statusLocked() Status {
	status := Status{
		Running:          s.server != nil,
		LANURLs:          []string{},
		CertURLs:         []string{},
		Recent:           append([]TrafficEntry(nil), s.traffic...),
		HTTPSInterceptOn: s.authority != nil,
	}
	if s.authority != nil {
		status.CertPath = s.authority.CertDERPath()
		status.CertFingerprint = s.authority.Fingerprint()
	}
	if s.listener != nil {
		status.Address = s.listener.Addr().String()
		status.LANURLs = lanURLs(s.listener.Addr())
		for _, lanURL := range status.LANURLs {
			status.CertURLs = append(status.CertURLs, lanURL+"/rootCA.cer")
		}
	}
	return status
}

func maxTrafficID(entries []TrafficEntry) int64 {
	var maxID int64
	for _, entry := range entries {
		if entry.ID > maxID {
			maxID = entry.ID
		}
	}
	return maxID
}
