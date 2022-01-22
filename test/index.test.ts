import request from 'supertest'
import express from 'express'
import * as MongoDb from 'mongodb'
import bodyParser from 'body-parser'

import Japer from '../src'
import Envelope from '../src/Envelope'
import Store from '../src/Store'
import { MemoryStore } from '../src/Store/MemoryStore'
import { MongoDbStore } from '../src/Store/MongoDbStore'
import patches from './fixtures/patches'

import { setTestDbName } from './utils/setTestDbName'
const dbName = setTestDbName(__filename)

const storeNames = ['mongoDb', 'memory']
// const storeNames = ['memory']
let app: express.Express
let japer: Japer

beforeEach(() => {
  jest.setTimeout(60000)
})

describe(`Japer`, () => {

  storeNames.forEach(storeName => {
    const url = `/japer-${storeName.toLowerCase()}`
    let store: Store

    describe(`with store ${storeName}`, () => {

      beforeAll(async () => {
        await new Promise(resolve => {
          setTimeout(resolve, 1000)
        })
      })

      if (storeName === 'mongoDb') {
        let mongoDb: MongoDb.Db | null = null
        let dbClient: MongoDb.MongoClient | null = null

        beforeAll(async () => {
          dbClient = new MongoDb.MongoClient(`mongodb://localhost:27017/${dbName}`)
          mongoDb = dbClient.db(dbName)
          await dbClient.connect()
        })

        afterAll(async () => {
          await dbClient?.close()
        })

        beforeEach(() => {
          store = new MongoDbStore(mongoDb!)
          japer = new Japer({ store: store })
        })

      } else if (storeName == 'memory') {

        beforeEach(() => {
          store = new MemoryStore()
          japer = new Japer({ store: store })
        })

      } else {
        throw new Error(`No setup for ${storeName} store`)
      }

      beforeEach(() => {
        app = express()

        // TODO bodyParser needs to be dev dependency
        app.use(bodyParser.json())
        app.use(bodyParser.urlencoded({ extended: false }))
        app.use(url, japer.router)
      })

      beforeEach(async () => {
        await request(app)
          .get(`${url}/reset`)
        expect(200)
      })

      describe('/document', () => {
        it('should throw an error if the document does not exist', async () => {
          await request(app)
            .delete(`${url}/some-doc/1/document`)
            .expect(404)
        })

        it('should create a new document', async () => {
          const result = await request(app)
            .post(`${url}/some-doc/document`)
            .send({ a: 1, b: 2 })
            .expect(200)

          await request(app)
            .get(`${url}/some-doc/${result.body.id}/document`)
            .expect(200)
        })

        it('should not be able to create a document called "document', async () => {
          const result = await request(app)
            .post(`${url}/document/document`)
            .send({ a: 1, b: 2 })
            .expect(400)
        })

        it('should fail to create a new document version with id', async () => {
          await request(app)
            .post(`${url}/some-not-created-doc/1/document`)
            .send({ a: 1, b: 2 })
            .expect(403)
        })

        it('should get a document with version and id', async () => {
          const doc = { document: { a: 1, b: 2 } }
          const id = (await request(app)
            .post(`${url}/some-doc/document`)
            .send(doc)
            .expect(200)).body.id
          const result = await request(app)
            .get(`${url}/some-doc/${id}/document`)
            .expect(200)

          expect(result.body).toEqual({
            id: id,
            version: 0,
            document: { a: 1, b: 2 }
          })
        })

        it('should not expose the extra object', async () => {
          const doc = { a: 1, b: 2 }
          const id = (await request(app)
            .post(`${url}/some-doc/document`)
            .send(doc)
            .expect(200)).body.id
          const result = await request(app)
            .get(`${url}/some-doc/${id}/document`)
            .expect(200)

          expect(result.body.extra).toBe(undefined)
        })

        it('should get several document', async () => {
          const doc1 = { a: 1, b: 2 }
          const doc2 = { c: 1, d: 2 }

          const id1 = (await request(app)
            .post(`${url}/xsome-doc/document`)
            .send({ document: doc1 })
            .expect(200)).body.id
          const id2 = (await request(app)
            .post(`${url}/xsome-doc/document`)
            .send({ document: doc2 })
            .expect(200)).body.id

          const result1 = await request(app)
            .get(`${url}/xsome-doc/${id1}/document`)
            .expect(200)
          const result2 = await request(app)
            .get(`${url}/xsome-doc/${id2}/document`)
            .expect(200)

          expect(result1.body).toEqual({ id: id1, version: 0, document: doc1 })
          expect(result2.body).toEqual({ id: id2, version: 0, document: doc2 })
        })

        it('should update an existing document', async () => {
          const docVersion0 = { a: 1, b: 2 }
          const docVersion1 = { a: 1, c: 3 }
          const { id, version } = (await request(app)
            .post(`${url}/some-doc/document`)
            .send({ document: docVersion0 })
            .expect(200)).body

          expect(version).toBe(0)

          const result1 = await request(app)
            .get(`${url}/some-doc/${id}/document`)
            .expect(200)

          expect(result1.body.version).toEqual(0)

          await request(app)
            .post(`${url}/some-doc/${id}/document`)
            .send({ document: docVersion1, version: version })
            .expect(200)

          const result2 = await request(app)
            .get(`${url}/some-doc/${id}/document`)
            .expect(200)

          expect(result2.body).toEqual({ id: id, version: 1, document: docVersion1 })
        })

        it('should delete a document if it exists', async () => {
          const result = await request(app)
            .post(`${url}/some-doc/document`)
            .send({ a: 1, b: 2 })
            .expect(200)

          await request(app)
            .delete(`${url}/some-doc/${result.body.id}/document`)
            .expect(200)
        })

        it('should fail if deleting non existant document', async () => {
          await request(app)
            .delete(`${url}/some-doc/99/document`)
            .expect(404)
        })

        it('should handle multiple documents', async () => {
          const document1 = { a: 1, b: 2 }
          const document2 = { a: 1, c: 3 }
          const document3 = { a: 1, d: 4 }
          const document4 = { a: 1, e: 5 }

          const postResult1 = await request(app)
            .post(`${url}/doc1/document`)
            .send({ document: document1 })
            .expect(200)
          const postResult2 = await request(app)
            .post(`${url}/doc2/document`)
            .send({ document: document2 })
            .expect(200)
          const postResult3 = await request(app)
            .post(`${url}/doc3/document`)
            .send({ document: document3 })
            .expect(200)
          const postResult4 = await request(app)
            .post(`${url}/doc3/document`)
            .send({ document: document4 })
            .expect(200)

          const result1 = await request(app)
            .get(`${url}/doc1/${postResult1.body.id}/document`)
            .expect(200)
          const result2 = await request(app)
            .get(`${url}/doc2/${postResult2.body.id}/document`)
            .expect(200)
          const result3 = await request(app)
            .get(`${url}/doc3/${postResult3.body.id}/document`)
            .expect(200)
          const result4 = await request(app)
            .get(`${url}/doc3/${postResult4.body.id}/document`)
            .expect(200)

          expect(result1.body.document).toEqual(document1)
          expect(result2.body.document).toEqual(document2)
          expect(result3.body.document).toEqual(document3)
          expect(result4.body.document).toEqual(document4)
        })

        it('should accept a new version of a document', async () => {
          const firstDoc = { a: 1, b: 2 }
          const secondDoc = { a: 1, c: 'foo', d: { dd: 1, dc: 3 } }

          const { id, version } = (await request(app)
            .post(`${url}/some-doc/document`)
            .send({ document: firstDoc })
            .expect(200)).body

          expect(version).toBe(0)

          const getFirstVersionResult = await request(app)
            .get(`${url}/some-doc/${id}/document`)
            .expect(200)

          expect(getFirstVersionResult.body.version).toBe(version)
          expect(getFirstVersionResult.body.document).toEqual(firstDoc)

          await request(app)
            .post(`${url}/some-doc/${id}/document`)
            .send({ document: secondDoc, version: version })
            .expect(200)

          const getSecondVersionResult = await request(app)
            .get(`${url}/some-doc/${id}/document`)
            .expect(200)

          expect(getSecondVersionResult.body.version).toBe(1)
          expect(getSecondVersionResult.body.document).toEqual(secondDoc)
        })

        it('should handle many documents on the same key', async () => {
          const loops = 50
          const postResults = [], results = []

          for (let i = 0; i < loops; i++) {
            const result = await request(app)
              .post(`${url}/doc/document`)
              .send({ document: { a: i, b: i + 1 } })
              .expect(200)
            postResults.push(result)
          }

          for (let i = 0; i < loops; i++) {
            const result = await request(app)
              .get(`${url}/doc/${postResults[i].body.id}/document`)
              .expect(200)
            results.push(result)
          }

          for (let i = 0; i < loops; i++) {
            expect(results[i].body.document).toEqual({ a: i, b: i + 1 })
          }

          const allDocsResult = await request(app)
            .get(`${url}/doc/document`)
            .expect(200)

          expect(allDocsResult.body.length).toBe(loops)
        })
      })

      describe('/patch', () => {
        it('should fail if the document does not exist', async () => {
          const result = await request(app)
            .patch(`${url}/some-doc/99/patch/0`)
            .send(patches[0].operations)
            .expect(403)
        })

        // THIS WONT WORK
        // it('should create a new document from a zero version patch', async () => {
        //   const result = await request(app)
        //     .patch('/japer/some-doc/patch/0')
        //     .send(patches[0].operations)
        //     .expect(200)

        //   expect(result.body.version).toBe(1)
        // })

        it('should throw an error if the document does not exist', async () => {
          await request(app)
            .get(`${url}/some-doc/1/patch/0`)
            .expect(400)
        })

        it('should deliver all the patches after and including specified version', async () => {
          const docId = (await request(app)
            .post(`${url}/some-doc/document`)
            .send({ document: {} })
            .expect(200)).body.id

          let getPatchResult

          getPatchResult = await request(app)
            .get(`${url}/some-doc/${docId}/patch/0`)
            .expect(200)

          expect(getPatchResult.body).toEqual([])

          const patchResult1 = await request(app)
            .patch(`${url}/some-doc/${docId}/patch/0`)
            .send(patches[0].operations)
            .expect(200)
          expect(patchResult1.body.version).toBe(1)

          getPatchResult = await request(app)
            .get(`${url}/some-doc/${docId}/patch/0`)
            .expect(200)
          expect(getPatchResult.body[0].version).toBe(0)
          expect(getPatchResult.body[0].operations.length).toBe(2)

          const patchResult2 = await request(app)
            .patch(`${url}/some-doc/${docId}/patch/1`)
            .send(patches[1].operations)
            .expect(200)
          expect(patchResult2.body.version).toBe(2)

          getPatchResult = await request(app)
            .get(`${url}/some-doc/${docId}/patch/1`)
            .expect(200)

          expect(getPatchResult.body[0].version).toBe(1)
          expect(getPatchResult.body[0].operations.length).toBe(3)
        })

        it('should build a document from patches', async () => {
          const docId = (await request(app)
            .post(`${url}/some-doc/document`)
            .send({ document: {} })
            .expect(200)).body.id

          await request(app)
            .patch(`${url}/some-doc/${docId}/patch/0`)
            .send(patches[0].operations)
            .expect(200)

          await request(app)
            .patch(`${url}/some-doc/${docId}/patch/1`)
            .send(patches[1].operations)
            .expect(200)
          await request(app)
            .patch(`${url}/some-doc/${docId}/patch/2`)
            .send(patches[2].operations)
            .expect(200)

          const result = await request(app)
            .get(`${url}/some-doc/${docId}/document`)
            .expect(200)

          expect(result.body.version).toBe(3)
          expect(result.body.document).toEqual({ a: 2, b: 9, c: 'C1', d: { dd: 1 } })
        })
      })
    })
  })
})
