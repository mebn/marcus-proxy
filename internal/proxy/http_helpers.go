package proxy

import (
	"bytes"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
)

var hopHeaders = []string{
	"Connection",
	"Keep-Alive",
	"Proxy-Authenticate",
	"Proxy-Authorization",
	"Te",
	"Trailer",
	"Transfer-Encoding",
	"Upgrade",
}

func readResponse(resp *http.Response) ([]byte, string, bool, map[string][]string, error) {
	removeHopHeaders(resp.Header)
	headers := cloneHeader(resp.Header)
	body, err := io.ReadAll(resp.Body)
	preview, truncated := bodyPreview(body)
	return body, preview, truncated, headers, err
}

func copyHeader(dst http.Header, src http.Header) {
	for key, values := range src {
		for _, value := range values {
			dst.Add(key, value)
		}
	}
}

func writeErrorResponse(w io.Writer, status int, message string) error {
	resp := &http.Response{
		StatusCode:    status,
		Status:        fmt.Sprintf("%d %s", status, http.StatusText(status)),
		Proto:         "HTTP/1.1",
		ProtoMajor:    1,
		ProtoMinor:    1,
		Header:        make(http.Header),
		Body:          io.NopCloser(strings.NewReader(message)),
		ContentLength: int64(len(message)),
	}
	resp.Header.Set("Content-Type", "text/plain; charset=utf-8")
	return resp.Write(w)
}

func captureRequestBody(req *http.Request) (string, bool, error) {
	if req.Body == nil || req.Body == http.NoBody {
		return "", false, nil
	}
	body, err := io.ReadAll(req.Body)
	if err != nil {
		return "", false, err
	}
	req.Body.Close()
	req.Body = io.NopCloser(bytes.NewReader(body))
	req.ContentLength = int64(len(body))
	req.GetBody = func() (io.ReadCloser, error) {
		return io.NopCloser(bytes.NewReader(body)), nil
	}
	preview, truncated := bodyPreview(body)
	return preview, truncated, nil
}

func bodyPreview(body []byte) (string, bool) {
	truncated := len(body) > maxBodyPreviewBytes
	if truncated {
		body = body[:maxBodyPreviewBytes]
	}
	if len(body) == 0 {
		return "", false
	}
	text := strings.ToValidUTF8(string(body), "\uFFFD")
	if truncated {
		text += "\n\n[truncated]"
	}
	return text, truncated
}

func cloneHeader(header http.Header) map[string][]string {
	if len(header) == 0 {
		return nil
	}
	clone := make(map[string][]string, len(header))
	for key, values := range header {
		clone[key] = append([]string(nil), values...)
	}
	return clone
}

func removeHopHeaders(header http.Header) {
	for _, name := range hopHeaders {
		header.Del(name)
	}
}

func lanURLs(addr net.Addr) []string {
	_, port, err := net.SplitHostPort(addr.String())
	if err != nil {
		return nil
	}

	var urls []string
	ifaces, err := net.Interfaces()
	if err != nil {
		return []string{fmt.Sprintf("http://127.0.0.1:%s", port)}
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addLANURLs(&urls, iface, port)
	}
	if len(urls) == 0 {
		urls = append(urls, fmt.Sprintf("http://127.0.0.1:%s", port))
	}
	return urls
}

func addLANURLs(urls *[]string, iface net.Interface, port string) {
	addrs, err := iface.Addrs()
	if err != nil {
		return
	}
	for _, ifaceAddr := range addrs {
		ipNet, ok := ifaceAddr.(*net.IPNet)
		if !ok {
			continue
		}
		ip := ipNet.IP.To4()
		if ip == nil || ip.IsLoopback() {
			continue
		}
		*urls = append(*urls, fmt.Sprintf("http://%s:%s", ip.String(), port))
	}
}
