package proxy

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/hex"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	caCertFile = "rootCA.pem"
	caKeyFile  = "rootCA.key"
	caDERFile  = "rootCA.cer"
)

type Authority struct {
	mu          sync.Mutex
	cert        *x509.Certificate
	key         *ecdsa.PrivateKey
	certPEM     []byte
	certDER     []byte
	certPath    string
	certDERPath string
	fingerprint string
	leafCache   map[string]tls.Certificate
}

func LoadOrCreateAuthority() (*Authority, error) {
	return loadAuthority(false)
}

func RegenerateAuthority() (*Authority, error) {
	return loadAuthority(true)
}

func loadAuthority(forceCreate bool) (*Authority, error) {
	dir, err := os.UserConfigDir()
	if err != nil || dir == "" {
		dir = os.TempDir()
	}
	dir = filepath.Join(dir, "marcus-proxy")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}

	certPath := filepath.Join(dir, caCertFile)
	keyPath := filepath.Join(dir, caKeyFile)
	derPath := filepath.Join(dir, caDERFile)

	certPEM, keyPEM, err := readOrCreateCA(certPath, keyPath, derPath, forceCreate)
	if err != nil {
		return nil, err
	}

	certBlock, _ := pem.Decode(certPEM)
	if certBlock == nil {
		return nil, fmt.Errorf("failed to decode root certificate")
	}
	keyBlock, _ := pem.Decode(keyPEM)
	if keyBlock == nil {
		return nil, fmt.Errorf("failed to decode root key")
	}

	cert, err := x509.ParseCertificate(certBlock.Bytes)
	if err != nil {
		return nil, err
	}
	key, err := x509.ParseECPrivateKey(keyBlock.Bytes)
	if err != nil {
		return nil, err
	}

	sum := sha256.Sum256(cert.Raw)
	return &Authority{
		cert:        cert,
		key:         key,
		certPEM:     certPEM,
		certDER:     cert.Raw,
		certPath:    certPath,
		certDERPath: derPath,
		fingerprint: strings.ToUpper(hex.EncodeToString(sum[:])),
		leafCache:   make(map[string]tls.Certificate),
	}, nil
}

func (a *Authority) RootDER() []byte {
	return append([]byte(nil), a.certDER...)
}

func (a *Authority) Fingerprint() string {
	return a.fingerprint
}

func (a *Authority) CertPath() string {
	return a.certPath
}

func (a *Authority) CertDERPath() string {
	return a.certDERPath
}

func (a *Authority) CertificateForHost(host string) (tls.Certificate, error) {
	host = stripPort(host)
	if host == "" {
		return tls.Certificate{}, fmt.Errorf("empty host")
	}

	a.mu.Lock()
	if cert, ok := a.leafCache[host]; ok {
		a.mu.Unlock()
		return cert, nil
	}
	a.mu.Unlock()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return tls.Certificate{}, err
	}
	serial, err := randomSerial()
	if err != nil {
		return tls.Certificate{}, err
	}

	tmpl := &x509.Certificate{
		SerialNumber: serial,
		Subject: pkix.Name{
			CommonName: host,
		},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(48 * time.Hour),
		KeyUsage:              x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
	}
	if ip := net.ParseIP(host); ip != nil {
		tmpl.IPAddresses = []net.IP{ip}
	} else {
		tmpl.DNSNames = []string{host}
	}

	der, err := x509.CreateCertificate(rand.Reader, tmpl, a.cert, &key.PublicKey, a.key)
	if err != nil {
		return tls.Certificate{}, err
	}
	keyDER, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		return tls.Certificate{}, err
	}

	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})
	leaf, err := tls.X509KeyPair(certPEM, keyPEM)
	if err != nil {
		return tls.Certificate{}, err
	}

	a.mu.Lock()
	a.leafCache[host] = leaf
	a.mu.Unlock()
	return leaf, nil
}

func readOrCreateCA(certPath, keyPath, derPath string, forceCreate bool) ([]byte, []byte, error) {
	certPEM, certErr := os.ReadFile(certPath)
	keyPEM, keyErr := os.ReadFile(keyPath)
	if !forceCreate && certErr == nil && keyErr == nil {
		return certPEM, keyPEM, nil
	}

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, nil, err
	}
	serial, err := randomSerial()
	if err != nil {
		return nil, nil, err
	}
	tmpl := &x509.Certificate{
		SerialNumber: serial,
		Subject: pkix.Name{
			CommonName:   "marcus-proxy local root CA",
			Organization: []string{"marcus-proxy"},
		},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().AddDate(10, 0, 0),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign | x509.KeyUsageDigitalSignature,
		IsCA:                  true,
		BasicConstraintsValid: true,
		MaxPathLenZero:        true,
	}

	certDER, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		return nil, nil, err
	}
	keyDER, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		return nil, nil, err
	}

	certPEM = pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER})
	keyPEM = pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})

	if err := os.WriteFile(certPath, certPEM, 0o644); err != nil {
		return nil, nil, err
	}
	if err := os.WriteFile(keyPath, keyPEM, 0o600); err != nil {
		return nil, nil, err
	}
	if err := os.WriteFile(derPath, certDER, 0o644); err != nil {
		return nil, nil, err
	}
	return certPEM, keyPEM, nil
}

func randomSerial() (*big.Int, error) {
	limit := new(big.Int).Lsh(big.NewInt(1), 128)
	return rand.Int(rand.Reader, limit)
}

func stripPort(host string) string {
	host = strings.TrimSpace(host)
	if h, _, err := net.SplitHostPort(host); err == nil {
		return h
	}
	return host
}
