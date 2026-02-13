# Morgan Hub - Local Static Server
# Serves the dashboard on port 3333, proxied by Tailscale Serve on :3334
$ErrorActionPreference = "SilentlyContinue"

# Kill any existing server on port 3333
Get-NetTCPConnection -LocalPort 3333 -State Listen 2>$null | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force 2>$null
}
Start-Sleep -Seconds 1

# Start custom Node server
Start-Process -FilePath "node" -ArgumentList "`"C:\Users\openc\.openclaw\workspace\projects\morgan-hub\server.js`"" -WindowStyle Hidden

# Ensure Tailscale Serve is configured
& tailscale serve --bg --https 3334 http://localhost:3333 2>$null
