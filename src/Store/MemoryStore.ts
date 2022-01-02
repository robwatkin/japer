
import Store from '../Store'
import Envelope from '../Envelope'
import Filer from './Filer'

export class MemoryStore implements Store {
  private _store?: Map<string, Map<string, Envelope>>
  private _filter?: (envelope: Envelope) => boolean
  private _filer?: Filer

  constructor(filename?: string) {
    if (filename) {
      this._filer = new Filer(filename)
    }
  }

  // TODO use getter and setter instead
  private async _getStore(): Promise<Map<string, Map<string, Envelope>>> {
    if (!this._store) {
      if (this._filer) {
        this._store = await this._filer.read() as Map<string, Map<string, Envelope>>
      } else {
        this._store = new Map()
      }
    }
    return this._store
  }

  async exists(key: string, id: string): Promise<boolean> {
    const store = await this._getStore()
    return !!store.has(key) && !!store.get(key)?.has(id)
  }

  async read(key: string, id: string): Promise<Envelope | null> {
    const store = await this._getStore()
    if (!store.has(key)) {
      throw new Error(`document ${key} not found`)
    }
    if (!store.get(key)?.has(id)) {
      throw new Error(`document ${key} id: ${id} not found`)
    }

    const values = { ...store.get(key)?.get(id) }
    const envelope = Envelope.makeEnvelope(id, values)

    if (this._filter && !this._filter(envelope)) {
      return null
    }
    return envelope
  }

  async readMany(key: string): Promise<Envelope[]> {
    const store = await this._getStore()

    if (!store.has(key)) {
      throw new Error(`document ${key} not found`)
    }
    const envelopes: Envelope[] = []

    store.get(key)?.forEach((v, k) => {
      const envelope = Envelope.makeEnvelope(k, { ...v })
      if (!this._filter || (this._filter && this._filter(envelope))) {
        envelopes.push(envelope)
      }
    })
    return envelopes
  }

  async write(key: string, id: string | null, value: Envelope): Promise<string> {
    const store = await this._getStore()
    const randomId = (keyMap: Map<string, Envelope>) => {
      let digits = 1
      while (true) {
        const random = Math.floor(Math.random() * 10 ** digits).toString()
        if (!keyMap.has(random)) {
          return random
        }
        if (digits <= 6) {
          digits++
        }
      }
    }

    if (!store.has(key)) {
      store.set(key, new Map())
    }
    if (!id) {
      id = randomId(store.get(key) as Map<string, Envelope>)
    }
    store.get(key)?.set(id, value)
    if (this._filer) {
      this._filer.write(store)
    }
    return id
  }

  async delete(key: string, id: string): Promise<void> {
    const store = await this._getStore()

    if (!store.has(key)) {
      throw new Error(`document ${key} not found`)
    }
    if (!store.get(key)?.has(id)) {
      throw new Error(`document ${key} id: ${id} not found`)
    }
    store.get(key)?.delete(id)
    if (store.get(key)?.size === 0) {
      store.delete(key)
    }
    if (this._filer) {
      this._filer.write(store)
    }
  }

  async reset(): Promise<void> {
    const store = await this._getStore()

    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      store.clear()
      if (this._filer) {
        this._filer.write(store)
      }
    } else {
      new Error('Store reset only allowed in test or development mode')
    }
  }

  setFilter(filter: (envelope: Envelope) => boolean): void {
    this._filter = filter
  }
}
