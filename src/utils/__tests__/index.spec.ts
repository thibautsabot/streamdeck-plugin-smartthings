import 'isomorphic-fetch'

import { addSelectOption, fetchApi, isGlobalSettingsSet } from '../index'

import { queryByAttribute } from '@testing-library/dom'
import { http, HttpResponse } from 'msw'
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
        http.get('https://api.smartthings.com/v1/test', () => {
          return HttpResponse.json({})
        }),
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
  })

  describe('isGlobalSettingsSet', () => {
    it('does not throw on undefined or null settings (after sign out)', () => {
      expect(isGlobalSettingsSet(undefined)).toBe(false)
      expect(isGlobalSettingsSet(null)).toBe(false)
    })

    it('is false for empty settings and true for complete ones', () => {
      expect(isGlobalSettingsSet({})).toBe(false)
      expect(
        isGlobalSettingsSet({ oauthTokens: {}, oauthClientId: 'id', oauthClientSecret: 'secret' }),
      ).toBe(true)
    })
  })
})
