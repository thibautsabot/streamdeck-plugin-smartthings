import { KeyUpEvent, WillAppearEvent, StateType, TargetType } from 'streamdeck-typescript'
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

  setSettings<Settings = any>(settings: Settings, context: string): void {}

  requestSettings(context: string): void {}

  setGlobalSettings<GlobalSettings = any>(settings: GlobalSettings): void {}

  requestGlobalSettings(): void {}

  openUrl(url: string): void {}

  logMessage(message: string): void {}

  send(event: PossibleEventsToSend, data: unknown): void {}

  enableDebug(): void {}

  addEventListener(event: string, fnc: Function): void {}
}

export function fakeKeyUpEvent<T>(settings: T): KeyUpEvent<T> {
  const coordinates = {
    column: 0,
    row: 0,
  }
  const state = StateType.ON
  const userDesiredState = StateType.ON
  const isInMultiAction = false
  const action = ''
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

export function fakeWillAppearEvent<T>(settings: T): WillAppearEvent<T> {
  const coordinates = {
    column: 0,
    row: 0,
  }
  const state = StateType.ON
  const isInMultiAction = false
  const action = ''
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
