# Marcus Proxy

A forward proxy for capturing, inspecting, and analyzing API traffic from mobile apps. Built with Go, TypeScript, and Wails.

<p align="center">
  <img src="images/homeview3.png" width="1000">
</p>

## Why?

To reverse engineer the APIs used by mobile apps, of course!

## Features

Current features:

<<<<<<< HEAD
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
=======
- Capture and inspect HTTP/HTTPS traffic from mobile apps
- View request and response headers, bodies, and metadata
- Intercept, modify, and forward requests and responses
- Replay and resend modified requests
- Quick Capture mode for getting started in seconds
- Save and restore capture sessions
- Search and filter captured traffic
- Organize requests by host and pinned items
- Flexible request detail layouts (bottom, right, and sidebar panels)
- Light mode (use at your own risk)
>>>>>>> 50ec1ef (intercept and edit request/response. resend request. more UI tweaks)

## Development

Start a development server with hot reload:

```bash
wails dev
```

### Prerequisites

- [Go](https://go.dev/)
- [Wails](https://wails.io/)
