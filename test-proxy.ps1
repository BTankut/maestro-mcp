# PowerShell script to test the proxy
$process = Start-Process -FilePath "node" -ArgumentList "C:\Users\BT\CascadeProjects\Maestro-MCP\server\dist\index.js" -NoNewWindow -RedirectStandardInput -RedirectStandardOutput -RedirectStandardError -PassThru

Start-Sleep -Seconds 2

# Send initialize request
$initRequest = '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}'
$process.StandardInput.WriteLine($initRequest)

Start-Sleep -Seconds 1

# Read response
$response = $process.StandardOutput.ReadLine()
Write-Host "Response: $response"

$process.Kill()