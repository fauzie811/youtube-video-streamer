import { writable } from 'svelte/store'

const prepareStreams = (streams) =>
  streams.map((stream) => ({
    ...stream,
    status: 'ready',
    statusText: 'Ready'
  }))

const createStreamStore = (key, initial = []) => {
  const toString = (value) => JSON.stringify(value, null, 2)
  const toObj = JSON.parse

  if (localStorage.getItem(key) === null) {
    localStorage.setItem(key, toString(initial))
  }

  const saved = toObj(localStorage.getItem(key))
  const prepared = prepareStreams(saved)
  const { subscribe, set } = writable(prepared)

  return {
    subscribe,
    set: (value) => {
      localStorage.setItem(key, toString(value))
      return set(value)
    },
    update: (fn) => {
      const value = fn(toObj(localStorage.getItem(key)))
      localStorage.setItem(key, toString(value))
      return set(value)
    }
  }
}

export default createStreamStore('streams', [])
