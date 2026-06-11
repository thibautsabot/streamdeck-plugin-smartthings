import {
  KeyUpEvent,
  WillAppearEvent,
  WillDisappearEvent,
  DidReceiveSettingsEvent,
  StateType,
  TargetType,
} from 'streamdeck-typescript'
import { PossibleEventsToSend, StreamDeckPluginHandler } from 'streamdeck-typescript'

export class FakeStreamdeckApi extends StreamDeckPluginHandler {
  state: StateType
  title: string
  alert = 0
  okay = 0

  constructor() {
    super()
  }

  setState(state: StateType): void {
    this.state = state
  }

  showAlert(): void {
    this.alert++
  }

  showOk(): void {
    this.okay++
  }

  setTitle(title: string): void {
    this.title = title
  }

  setImage(image: string, context: string, target?: TargetType, state?: StateType): void {}

  switchToProfile(profile: string, device?: string): void {}

  sendToPropertyInspector(payload: unknown, action: string, context: string): void {}

  protected registerPi(actionInfo: string): void {}

  protected onOpen(): void {}

  protected onClose(): void {}

  protected onReady(): void {}

  setSettings<Settings = unknown>(settings: Settings, context: string): void {}

  requestSettings(context: string): void {}

  setGlobalSettings<GlobalSettings = unknown>(settings: GlobalSettings): void {}

  requestGlobalSettings(): void {}

  openUrl(url: string): void {}

  logMessage(message: string): void {}

  send(event: PossibleEventsToSend, data: unknown): void {}

  enableDebug(): void {}

  addEventListener(event: string, fnc: Function): void {}
}

export function createMockResponse<T>(json: T, ok: boolean = true, status: number = 200): Response {
  return {
    ok,
    status,
    json: async () => json,
    statusText: ok ? 'OK' : 'Error',
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: function () {
      return this
    },
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    text: async () => JSON.stringify(json),
  } as Response
}

/**
 * Helper to spy on private methods in tests
 * Usage: spyOnPrivateMethod(instance, 'methodName')
 */
export function spyOnPrivateMethod<T, K extends string>(
  instance: T,
  methodName: K,
): jest.SpyInstance {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jest.spyOn(instance as any, methodName)
}

export function fakeKeyUpEvent<T>(settings: T, actionUuid?: string): KeyUpEvent<T> {
  const coordinates = {
    column: 0,
    row: 0,
  }
  const state = StateType.ON
  const userDesiredState = StateType.ON
  const isInMultiAction = false
  const action = actionUuid || ''
  const context = ''
  const device = ''
  const event = 'keyUp'

  return {
    payload: {
      settings,
      coordinates,
      state,
      userDesiredState,
      isInMultiAction,
    },
    action,
    context,
    device,
    event,
  }
}

export function fakeWillAppearEvent<T>(settings: T, actionUuid?: string): WillAppearEvent<T> {
  const coordinates = {
    column: 0,
    row: 0,
  }
  const state = StateType.ON
  const isInMultiAction = false
  const action = actionUuid || ''
  const context = ''
  const device = ''
  const event = 'willAppear'

  return {
    payload: {
      settings,
      coordinates,
      state,
      isInMultiAction,
      controller: 'Encoder',
    },
    action,
    context,
    device,
    event,
  }
}

export function fakeWillDisappearEvent<T>(
  context: string = '',
  settings?: T,
  actionUuid?: string,
): WillDisappearEvent<T> {
  const coordinates = {
    column: 0,
    row: 0,
  }
  const state = StateType.ON
  const isInMultiAction = false
  const action = actionUuid || ''
  const device = ''
  const event = 'willDisappear'

  return {
    payload: {
      settings: settings || ({} as T),
      coordinates,
      state,
      isInMultiAction,
      controller: 'Encoder',
    },
    action,
    context,
    device,
    event,
  }
}

export function fakeDidReceiveSettingsEvent<T>(
  context: string = '',
  settings: T,
  actionUuid?: string,
): DidReceiveSettingsEvent<T> {
  const coordinates = {
    column: 0,
    row: 0,
  }
  const isInMultiAction = false
  const action = actionUuid || ''
  const device = ''
  const event = 'didReceiveSettings'

  return {
    payload: {
      settings,
      coordinates,
      isInMultiAction,
      controller: 'Encoder',
    },
    action,
    context,
    device,
    event,
  }
}
