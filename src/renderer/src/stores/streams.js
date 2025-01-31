import { writable } from 'svelte/store'

function createStreamsStore() {
  const { subscribe, set, update } = writable([])

  return {
    subscribe,
    set,
    update,
    addLog: (streamId, message) => {
      update((streams) => {
        const timestamp = new Date().toLocaleString()
        const logEntry = `[${timestamp}] ${message}`

        return streams.map((stream) =>
          stream.id === streamId
            ? {
                ...stream,
                logs: [
                  ...(stream.logs || []).slice(-499), // Keep last 500 entries
                  logEntry
                ]
              }
            : stream
        )
      })
    }
  }
}

export default createStreamsStore()
