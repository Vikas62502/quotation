import { io, Socket } from "socket.io-client"

let socket: Socket | null = null
let subscribed = false
let currentToken: string | null = null

const getRealtimeBaseUrl = () => {
  if (typeof window === "undefined") return ""
  return process.env.NEXT_PUBLIC_API_URL || process.env.VITE_API_URL || window.location.origin
}

export const connectRealtime = (token: string) => {
  if (!token) return null
  const baseUrl = getRealtimeBaseUrl()
  if (!baseUrl) return null

  if (socket?.connected && currentToken === token) return socket

  if (socket && currentToken !== token) {
    socket.disconnect()
    socket = null
    subscribed = false
  }

  currentToken = token
  socket = io(baseUrl, {
    transports: ["websocket", "polling"],
    withCredentials: true,
    auth: { token },
  })

  socket.on("connect_error", (err) => {
    console.error("[realtime] connect_error:", err.message)
  })

  socket.on("disconnect", () => {
    subscribed = false
  })

  return socket
}

export const initRealtime = (token: string) => {
  const connectedSocket = connectRealtime(token)
  if (!connectedSocket) return null

  const subscribeAllStreams = () => {
    if (subscribed) return
    connectedSocket.emit("realtime:subscribe", "stream:backend")
    connectedSocket.emit("realtime:subscribe", ["stream:hr", "stream:admin", "stream:dealers"])
    subscribed = true
  }

  if (connectedSocket.connected) {
    subscribeAllStreams()
  } else {
    connectedSocket.once("connect", subscribeAllStreams)
  }

  return connectedSocket
}

export const getRealtime = () => socket

export const disconnectRealtime = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
  subscribed = false
  currentToken = null
}
