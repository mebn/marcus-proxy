# Marcus Proxy

A forward proxy for capturing, inspecting, and analyzing API traffic from mobile apps. Built with Go, TypeScript, and Wails.

<p align="center">
  <img src="images/homeview3.png" width="1000">
</p>

> **_NOTE:_** This project is in early development. Expected features may be missing, and the codebase is still being refactored.

## Why?

To reverse engineer the APIs used by mobile apps, of course!

## Features

Current features:

* Capture HTTP/HTTPS traffic from mobile apps using a proxy and root certificate
* Inspect request and response headers and bodies
* Quick Capture mode for getting started quickly
* Save captured requests as sessions
* Filter requests by HTTP method and content type
* Search captured requests
* Pin requests for quick access
* Group requests by host
* View request details in the bottom panel (`Cmd/Ctrl+B`) or right panel (`Cmd/Ctrl+R`)
* Open the left panel (`Cmd/Ctrl+L`) to browse pinned requests and host groups
* Light mode (use at your own risk)

## Development

Start a development server with hot reload:

```bash
wails dev
```

### Prerequisites

- [Go](https://go.dev/)
- [Wails](https://wails.io/)
