package main

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

func main() {
	if configuredURL := strings.TrimSpace(os.Getenv("CADDY_HEALTHCHECK_URL")); configuredURL != "" {
		runLoopbackHTTPHealthcheck(configuredURL)
		return
	}
	runPublicProxyHealthcheck()
}

func runLoopbackHTTPHealthcheck(configuredURL string) {
	target, err := url.ParseRequestURI(configuredURL)
	if err != nil || target.Scheme != "http" || target.User != nil ||
		(target.Hostname() != "127.0.0.1" && target.Hostname() != "::1") {
		fmt.Fprintln(os.Stderr, "caddy_healthcheck_url_invalid")
		os.Exit(1)
	}
	client := &http.Client{
		Timeout: 4 * time.Second,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	response, err := client.Get(target.String())
	if err != nil {
		fmt.Fprintln(os.Stderr, "caddy_healthcheck_request_failed")
		os.Exit(1)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		fmt.Fprintf(os.Stderr, "caddy_healthcheck_status_%d\n", response.StatusCode)
		os.Exit(1)
	}
}

func runPublicProxyHealthcheck() {
	host := strings.TrimSpace(os.Getenv("AGENT_PUBLIC_HOST"))
	if host == "" || strings.ContainsAny(host, "/ \\") {
		fmt.Fprintln(os.Stderr, "caddy_healthcheck_public_host_invalid")
		os.Exit(1)
	}
	rootCertificate, err := os.ReadFile("/data/caddy/pki/authorities/local/root.crt")
	if err != nil {
		fmt.Fprintln(os.Stderr, "caddy_healthcheck_root_certificate_unavailable")
		os.Exit(1)
	}
	rootCertificates := x509.NewCertPool()
	if !rootCertificates.AppendCertsFromPEM(rootCertificate) {
		fmt.Fprintln(os.Stderr, "caddy_healthcheck_root_certificate_invalid")
		os.Exit(1)
	}
	client := &http.Client{
		Timeout: 4 * time.Second,
		Transport: &http.Transport{TLSClientConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
			RootCAs:    rootCertificates,
			ServerName: host,
		}},
	}
	request, err := http.NewRequest(http.MethodGet, "https://127.0.0.1/api/health", nil)
	if err != nil {
		fmt.Fprintln(os.Stderr, "caddy_healthcheck_request_invalid")
		os.Exit(1)
	}
	request.Host = host
	response, err := client.Do(request)
	if err != nil {
		fmt.Fprintln(os.Stderr, "caddy_healthcheck_request_failed")
		os.Exit(1)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		fmt.Fprintf(os.Stderr, "caddy_healthcheck_status_%d\n", response.StatusCode)
		os.Exit(1)
	}
}
