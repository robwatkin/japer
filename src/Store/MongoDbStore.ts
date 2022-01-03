import * as MongoDb from 'mongodb'

import Store, { StoreError } from '../Store'
import Envelope from '../Envelope'

export class MongoDbStore implements Store {
  private _db: MongoDb.Db
  private _collections: Record<string, MongoDb.Collection> = {}
  private _filter?: () => {} = () => { return {} } 

  constructor(db: MongoDb.Db) {
    this._db = db
  }

  async exists(key: string, id: string): Promise<boolean> {
    try {
      await this.read(key, id)
      return true
    } catch (_error) {
      return false
    }
  }

  async read(key: string, id: string): Promise<Envelope> {

    const filter = this._filter ? this._filter() : {}
    // console.log(`++++ MongoDbStore _filter:`, filter)

    if (!this._collections[key]) {
      throw new StoreError('Unkown key ${key}')
    }

    const query = { _id: new MongoDb.ObjectId(id), ...filter }
    // console.log('++++ MongoDbStore query', query)
    const result = await this._collections[key]?.findOne( query )

    if (!result?._id) {
      throw new StoreError(`failed to find document ${key} id ${id}`)
    }

    const envelope = Envelope.makeEnvelope( result._id.toString(), result)
    // console.log('++++ MongoDbStore envelope', envelope)
    return envelope
  }

  async readMany(key: string): Promise<Envelope[]> {
    if (!this._collections[key]) {
      this._collections[key] = this._db?.collection(key)
    }

    const filter = this._filter ? this._filter() : {}
    const results = await this._collections[key]?.find( filter ).toArray()

    const envelopes: Envelope[] =  results.map(result => {
      const id = result._id.toString()
      const envelope = Envelope.makeEnvelope(id, {... result})
      return envelope
    })

    return envelopes
  }

  async write(key: string, id: string | null, value: Envelope): Promise<string> {
    if (!this._collections[key]) {
      this._collections[key] = this._db?.collection(key)
    }

    let result, objectId

    if (id) {
      try {
        objectId = new MongoDb.ObjectId(id)
      } catch (error) {
        throw new StoreError(`Bad id ${id}`)
      }

      result = await this._collections[key]?.updateOne({ _id: objectId }, { $set: value })

      if (!result?.acknowledged) {
        throw new StoreError(`Update on ${id} failed`)
      }
      return id

    } else {
      result = await this._collections[key]?.insertOne(value)
      if (!result.insertedId) {
        throw new Error(`failed to insert new document ${key}`)
      }
      return result.insertedId.toString()
    }
  }

  async delete(key: string, id: string): Promise<void> {
    if (!this._collections[key]) {
      throw new Error(`Unkown key ${key}`)
    }
    const result = await this._collections[key]?.deleteOne({ _id: new MongoDb.ObjectId(id) })

    if (result?.deletedCount === 1) {
      return
    }
    throw new Error(`Failed to delete document ${key} id ${id}`)
  }

  async reset(): Promise<void> {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      await this._db.dropDatabase()
    } else {
      new Error('Store reset only allowed in test or development mode')
    }
  }

  setFilter(filter: () => {}): void  {
    this._filter = filter
  }
}
