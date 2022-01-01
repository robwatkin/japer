import express from 'express'
import { StatusCodes } from 'http-status-codes'
import * as jsonpatch from 'fast-json-patch'

import { Operation } from './patch'
import Envelope from './Envelope'
import Store, { StoreError } from './Store'
import { logger } from './logger'
import { NextFunction } from 'express-serve-static-core'

declare global {
  namespace Express {
    interface Request {
      envelopes: Envelope[]
    }
  }
}

const validateOperations = (operations: Operation[]) => {

  const isPatch = (e: any) => (Object.keys(e).length === 3 && Object.keys(e).reduce((acc, key) => ['op', 'path', 'value'].includes(key) && acc, true))

  if (!Array.isArray(operations)) {
    throw new Error('expecting an array of patches')
  }
  operations.forEach(operation => {
    if (!isPatch(operation)) {
      throw new Error(`Bad operation ${operation} ${Object.keys(operation)}`)
    }
  })
}

export interface JaperHandlerAction {
  status: number
  message?: string
}

export type JaperHandler = (req: Express.Request, res: Express.Response, next: NextFunction) => JaperHandlerAction

class Japer {
  readonly router
  private store: Store
  private _handler?: unknown

  constructor(options: { store: Store }) {
    if (!options?.store) {
      throw new Error('You must define a store')
    }

    this.store = options.store
    this.router = express.Router()

    this.router.get(
      '/kick',
      async (req, res, _next) => {
        logger.debug('Japer GET /kick')
        return res.status(StatusCodes.OK).send({
          message: 'Hello cruel World!',
        })
      }
    )

    this.router.get('/:docName/:id/document', async (req, res, next) => {
      logger.debug(`Japer ${req.method} ${req.originalUrl}`)

      try {
        const { docName, id } = req.params

        if (docName.toLowerCase() === 'document') {
          throw new Error('Document name "document" not allowed')
        }

        const envelope = await this.store.read(docName, id)

        if(envelope) {
          req.envelopes = [envelope]
        }

        this.handleEnvelope(
          req, res, next,
          (_action) => {
            delete req.envelopes[0].patches
            delete req.envelopes[0].extra
            res.status(StatusCodes.OK).json(req.envelopes[0])
          },
          (action) => { res.status(action?.status).json({ message: action?.message }) }
        )
      } catch (error: unknown) {
        res.status(StatusCodes.BAD_REQUEST).send(error instanceof Error ? error.message : error)
      }
    })

    this.router.get('/:docName/document', async (req, res, next) => {
      logger.debug(`Japer ${req.method} ${req.originalUrl}`)

      try {
        const { docName } = req.params
        req.envelopes = await this.store.readMany(docName)

        this.handleEnvelope(
          req, res, next,
          (_action) => { res.status(StatusCodes.OK).json(req.envelopes.map(e => {
            delete e.patches
            delete e.extra
            return e
          })) },
          (action) => { res.status(action?.status).json({ message: action?.message }) }
        )
      } catch (error: unknown) {
        res.status(StatusCodes.BAD_REQUEST).send(error instanceof Error ? error.message : error)
      }
    })

    this.router.post('/:docName/document', async (req, res, next) => {
      logger.debug(`Japer ${req.method} ${req.originalUrl} body:`, req.body)

      try {
        const { docName } = req.params

        if (docName.toLowerCase() === 'document') {
          throw new Error('Document name "document" not allowed')
        }

        req.envelopes = [new Envelope(req.body.document)]

        this.handleEnvelope(
          req, res, next,
          async (action) => {

            const id = await this.store.write(docName, null, req.envelopes[0])
            return res.status(action.status).json({ id: id, version: req.envelopes[0].version })
          },
          (action) => { res.status(action?.status).json({ message: action?.message }) }
        )
      } catch (error: unknown) {
        res.status(StatusCodes.BAD_REQUEST).send(error instanceof Error ? error.message : error)
      }
    })

    // TODO should probably use PATCH method here
    this.router.post('/:docName/:id/document', async (req, res, next) => {
      logger.debug(`Japer ${req.method} ${req.originalUrl} body:`, req.body)

      try {
        const { docName, id } = req.params

        if (docName.toLowerCase() === 'document') {
          throw new Error('Document name "document" not allowed')
        }

        const newDoc = req.body.document
        const previousVersion = req.body.version
        const envelope = await this.store.read(docName, id)

        if(previousVersion !== envelope?.version) {
          throw new Error(`Version ${previousVersion} differs from stored version ${envelope?.version}`)
        }

        if (!envelope) {
          return res.status(StatusCodes.FORBIDDEN).json({ error: `document ${docName} id: ${id} already exists` })
        }

        const patch = {
          version: envelope.version,
          operations: jsonpatch.compare(envelope.document, newDoc)
        }
        envelope.version++
        envelope.addPatch(patch)
        envelope.document = newDoc

        req.envelopes = [envelope]
        this.handleEnvelope(
          req, res, next,
          async (action) => {
            await this.store.write(docName, id, req.envelopes[0])
            return res.status(action.status).json({ id: id, version: req.envelopes[0].version })
          },
          (action) => { res.status(action?.status).json({ message: action?.message }) }
        )

      } catch (error: unknown) {
        res.status(StatusCodes.FORBIDDEN).send(error instanceof Error ? error.message : error)
      }
    })

    this.router.delete('/:docName/:id/document', async (req, res, next) => {
      logger.debug(`Japer ${req.method} ${req.originalUrl}`)

      try {
        const { docName, id } = req.params

        req.envelopes = [new Envelope(req.body)]

        let action: JaperHandlerAction = { status: StatusCodes.OK, message: '' }

        if (this._handler) {

          const japerHandler: JaperHandler = this._handler as JaperHandler
          action = japerHandler(req, res, next)
          // action = this._handler(req, res, next)
          if (!action?.status) {
            throw new Error('Handler did not return an action')
          }
        }

        if (action?.status === StatusCodes.OK) {
          await this.store.delete(docName, id)
          return res.status(action.status).json({ id: id })
        }
        res.status(action?.status).json({ message: action?.message })

      } catch (error: unknown) {
        res.status(StatusCodes.NOT_FOUND).send(error instanceof Error ? error.message : error)
      }
    })

    // // Get all events since version of document

    this.router.get('/:docName/:id/patch/:version', async (req, res, next) => {
      logger.debug(`Japer ${req.method} ${req.originalUrl}`)

      try {
        const { docName, id, version } = req.params
        const envelopes = [await this.store.read(docName, id)]

        this.handleEnvelope(
          req, res, next,
          (_action) => {
            const patches = envelopes[0]?.getPatchesFromVersion(parseInt(version))
            res.status(StatusCodes.OK).json(patches)
          },
          (action: JaperHandlerAction) => {
            res.status(action?.status).json({ message: action?.message })
          }
        )

      } catch (error: unknown) {
        res.status(StatusCodes.BAD_REQUEST).send(error instanceof Error ? error.message : error)
      }
    })

    this.router.patch('/:docName/patch/:version', async (req, res) => {
      logger.debug(`Japer ${req.method} ${req.originalUrl} body`, req.body)
      throw new Error('Not implemented')
    })

    this.router.patch('/:docName/:id/patch/:version', async (req, res) => {
      logger.debug(`Japer ${req.method} ${req.originalUrl} body:`, req.body)

      try {
        const { docName, id, version } = req.params
        const newVersion = parseInt(version)
        const operations = req.body

        validateOperations(operations)

        // const envelope = await this.store.exists(docName, id) ?
        //   await this.store.read(docName, id) : new Envelope({})

        // TODO these two calls to store coulf be combined

        if (!(await this.store.exists(docName, id))) {
          return res.status(StatusCodes.FORBIDDEN).send(`Document ${docName}: ${id} does not exist`)
        }

        const envelope = await this.store.read(docName, id)

        if (envelope == null) {
          return res.sendStatus(StatusCodes.NOT_FOUND)
        }

        if (newVersion !== envelope.version) {
          return res.status(StatusCodes.BAD_REQUEST).json({ error: `document ${docName} id: ${id} version ${newVersion} is not compatible with current version` })
        }

        const newDocument = jsonpatch.applyPatch(envelope?.document, operations).newDocument

        if (!newDocument) {
          throw new Error('operations failed!')
        }

        const patch = {
          version: envelope.version,
          operations: operations
        }
        envelope.version++
        envelope.addPatch(patch)
        envelope.document = newDocument

        await this.store.write(docName, id, envelope)

        res.status(StatusCodes.OK).json({ version: envelope?.version })

      } catch (error: unknown) {
        if (error instanceof StoreError) {
          res.status(StatusCodes.FORBIDDEN).send(error instanceof StoreError ? error.message : error)
        } else {
          logger.debug('<> error', error) // TODO Don't send entire Error object
          res.status(StatusCodes.BAD_REQUEST).send(error instanceof Error ? error.message : error)
        }
      }
    })

    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {

      this.router.get('/reset', async (req, res) => {
        logger.debug(`${req.method} ${req.originalUrl}`)

        try {
          await this.store.reset()
          res.sendStatus(StatusCodes.OK)
        } catch (error: unknown) {
          logger.debug(error) // TODO Don't send entire Error object
          res.status(StatusCodes.BAD_REQUEST).send(error instanceof Error ? error.message : error)
        }
      })
    }
  }

  handleEnvelope(
    req: Express.Request,
    res: Express.Response,
    next: NextFunction,
    onOk: (action: JaperHandlerAction) => void,
    onBad: (action: JaperHandlerAction) => void) {
    let action: JaperHandlerAction = { status: StatusCodes.OK, message: '' }

    if (this._handler) {
      const japerHandler: JaperHandler = this._handler as JaperHandler
      action = japerHandler(req, res, next)
      // action = this._handler(req, res, next)

      if (!action?.status) {
        throw new Error('Handler did not return an action')
      }
    }

    if (action?.status === StatusCodes.OK) {
      return onOk(action)
    }
    onBad(action)
  }

  use(handler: unknown) {
    this._handler = handler
  }
}

export default Japer
