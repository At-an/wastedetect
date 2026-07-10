import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Automatically exposes the server to your local network (192.168...)
    allowedHosts: [
      '84f0-129-0-79-247.ngrok-free.app', // Allows your specific ngrok tunnel address
      '.ngrok-free.app'                  // Optional: allows any ngrok tunnel address so it won't break when the URL changes
    ]
  }   
})
