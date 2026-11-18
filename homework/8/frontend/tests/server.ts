import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { endpoint, success } from './fixtures'

export const server = setupServer(http.get(endpoint, () => HttpResponse.json(success)))
