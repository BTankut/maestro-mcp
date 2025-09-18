#!/usr/bin/env node

// Simple test to understand STDIO communication
console.error('[TEST] Starting STDIO echo server...');

process.stdin.on('data', (data) => {
  const message = data.toString();
  console.error('[TEST] Received:', message);

  // Echo back what we received
  process.stdout.write(message);
});

process.stdin.on('end', () => {
  console.error('[TEST] STDIO stream ended');
});

process.on('SIGINT', () => {
  console.error('[TEST] Received SIGINT');
  process.exit(0);
});

console.error('[TEST] STDIO echo server ready');