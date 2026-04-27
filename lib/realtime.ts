import { io, Socket } from "socket.io-client"

let socket: Socket | null = null
let subscribed = false
let currentToken: string | null = null
let loggedTransientConnectIssue = false

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
  if (socket && currentToken === token && !socket.connected) {
    socket.disconnect()
    socket = null
    subscribed = false
  }

  currentToken = token
  socket = io(baseUrl, {
    transports: ["websocket", "polling"],
    withCredentials: true,
    auth: { token },
    timeout: 10000,
    reconnection: true,
    reconnectionAttempts: 2,
  })

  socket.on("connect_error", (err) => {
    const msg = String(err?.message || "").toLowerCase()
    const isTransient = msg.includes("timeout") || msg.includes("xhr poll error") || msg.includes("websocket error")
    if (isTransient) {
      if (!loggedTransientConnectIssue) {
        console.warn("[realtime] unavailable; continuing without live updates.")
        loggedTransientConnectIssue = true
      }
      return
    }
    console.warn("[realtime] connect_error:", err.message)
  })

  socket.on("disconnect", () => {
    subscribed = false
  })

  socket.on("connect", () => {
    loggedTransientConnectIssue = false
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
