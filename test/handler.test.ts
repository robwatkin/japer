import request from 'supertest'
import express from 'express'
import bodyParser from 'body-parser'

import Japer, { JaperHandler, JaperHandlerAction } from '../src'
import Store from '../src/Store'
import { MemoryStore } from '../src/Store/MemoryStore'
import Envelope from '../src/Envelope'

// import { setTestDbName } from './utils/setTestDbName'
// const dbName = setTestDbName(__filename)

interface RequestWithEnvelopes extends Express.Request {
  envelopes: Envelope[]
}

// class EnvelopeWithUserId extends Envelope {
//   userId?: string

//   constructor(document: Record<string, unknown>, version = 0, patches: Patch[] = []) {
//     super(document, version, patches)
//   }
// }

describe('Handler', () => {
  let store: Store
  let japer: Japer
  let app: express.Express

  beforeEach(() => {
    store = new MemoryStore()
    japer = new Japer({ store: store })

    app = express()

    app.use(bodyParser.json())
    app.use(bodyParser.urlencoded({ extended: false }))
    app.use('/japer', japer.router)
  })

  it('should be called with an envelope on the request object', async () => {
    const handler = jest.fn(req => {
      return { status: 200 }
    })

    japer.use(handler)

    await request(app)
      .post('/japer/my-doc/document')
      .send({ document: { h: 1 } })
      .expect(200)

    expect(handler).toBeCalled()

    // Check the whole envelope was placed onto the req object
    expect(handler.mock.calls[0][0].envelopes).toEqual([{
      version: 0,
      patches: [],
      document: { h: 1 },
      extra: {}
    }])
  })

  it('Japer should accept docorations on the Envelope', async () => {
    // const handler: JaperHandler = (req) => {
    //   (req as RequestWithEnvelopes).envelopes[0].extra.userId = '1001'
    //   return { status: 200 }
    // }

    const handler = (req: Express.Request)  => {
      if(req.envelopes[0] &&  req.envelopes[0].extra) {

        req.envelopes[0].extra.userId = '1001'
      }
      return { status: 200}
    }

    japer.use(handler)

    const doc = { a: 'A', b: 'B' }
    const postResult = await request(app)
      .post('/japer/my-doc/document')
      .send({ document: doc })
      .expect(200)

    const id = postResult.body.id

    const result = await request(app)
      .get(`/japer/my-doc/${postResult.body.id}/document`)
      .expect(200)

    expect(result.body.document).toEqual(doc)
    const storedEnvelope = (await store.read('my-doc', id))
    expect((storedEnvelope?.extra?.userId)).toEqual('1001')
  })

  it('Japer should abort with error if the handler does not return OK', async () => {
    japer.use((req: Request) => {
      return { status: 400 }
    })
    await request(app)
      .post('/japer/my-doc/document')
      .send({ a: 'C' })
      .expect(400)
  })
})
