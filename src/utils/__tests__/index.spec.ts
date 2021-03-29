import 'isomorphic-fetch'

import { addSelectOption, fetchApi, isDeviceSetting, isSceneSetting } from '../index'

import { queryByAttribute } from '@testing-library/dom'
import { rest } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer()

describe('Test utils', () => {
  beforeAll(() => server.listen())
  afterAll(() => server.close())

  describe('fetchApi', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should call fetch', async () => {
      server.use(
        rest.get('https://api.smartthings.com/v1/test', (req, res, ctx) => {
          return res(ctx.json({}))
        })
      )

      jest.spyOn(window, 'fetch')

      await fetchApi({
        endpoint: '/test',
        method: 'GET',
        accessToken: 'dummyToken',
      })

      expect(window.fetch).toHaveBeenCalledWith('https://api.smartthings.com/v1/test', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer dummyToken',
        },
      })
    })

    it('should create a select option', () => {
      const select = document.createElement('select')

      addSelectOption({
        select,
        element: {
          id: 'myNewId',
          name: 'myNewName',
        },
      })

      expect(queryByAttribute('value', select, 'myNewId')).toBeTruthy()
    })

    it('should not create a select option if element is empty', () => {
      const select = document.createElement('select')

      addSelectOption({
        select,
        element: {
          id: 'myNewId',
          name: undefined,
        },
      })

      expect(queryByAttribute('value', select, 'myNewId')).toBeFalsy()
    })

    it('should recognize a device setting', () => {
      expect(isDeviceSetting({ deviceId: '42' })).toBeTruthy()
      expect(isDeviceSetting({ sceneId: '42' })).toBeFalsy()
    })

    it('should recognize a scene setting', () => {
      expect(isSceneSetting({ sceneId: '42' })).toBeTruthy()
      expect(isSceneSetting({ deviceId: '42' })).toBeFalsy()
    })
  })
})
