import {
  SDOnPiEvent,
  StreamDeckPropertyInspectorHandler,
  DidReceiveSettingsEvent,
} from 'streamdeck-typescript'
import { isGlobalSettingsSet, addSelectOption, SelectElement } from './utils/index'
import { GlobalSettingsInterface } from './utils/interface'

export abstract class BasePropertyInspector<
  TSettings
> extends StreamDeckPropertyInspectorHandler {
  protected selectOptions?: SelectElement[]
  protected selectedOptionId = ''

  constructor() {
    super()
  }

  @SDOnPiEvent('documentLoaded')
  onDocumentLoaded(): void {
    const validateButton = document.getElementById('validate_button') as HTMLButtonElement
    const select = document.getElementById('select_value') as HTMLSelectElement

    validateButton?.addEventListener('click', this.onValidateButtonPressed.bind(this))
    select?.addEventListener('change', this.onSelectChanged.bind(this))

    addSelectOption({ select, element: { id: 'none', name: this.getDefaultOptionLabel() } })
  }

  @SDOnPiEvent('globalSettingsAvailable')
  propertyInspectorDidAppear(): void {
    this.requestSettings()
    const globalSettings = this.settingsManager.getGlobalSettings<GlobalSettingsInterface>()

    if (isGlobalSettingsSet(globalSettings)) {
      const accessToken = globalSettings.accessToken
      if (accessToken) {
        ;(<HTMLInputElement>document.getElementById('accesstoken')).value = accessToken
      }
    }
  }

  protected async onValidateButtonPressed() {
    const accessToken = (<HTMLInputElement>document.getElementById('accesstoken'))?.value
    this.settingsManager.setGlobalSettings<GlobalSettingsInterface>({ accessToken })

    const elements = await this.fetchOptions(accessToken)
    this.selectOptions = elements
    this.populateDropdown()
  }

  protected populateDropdown(): void {
    const select = document.getElementById('select_value') as HTMLSelectElement
    if (!select || !this.selectOptions) return

    select.length = 1

    this.selectOptions.forEach((element) => addSelectOption({ select, element }))
  }

  protected async onSelectChanged(e: Event) {
    const newSelection = (e.target as HTMLSelectElement).value
    this.selectedOptionId = newSelection
    this.saveSettings()
  }

  protected selectOptionInDropdown(id: string): void {
    const activeIndex = this.selectOptions?.findIndex((element) => element.id === id)
    const select = document.getElementById('select_value') as HTMLSelectElement
    if (select) {
      select.selectedIndex = activeIndex !== undefined && activeIndex >= 0 ? activeIndex + 1 : 0
    }
  }

  protected abstract getDefaultOptionLabel(): string
  protected abstract fetchOptions(accessToken: string): Promise<SelectElement[]>
  protected abstract saveSettings(): void
  abstract onReceiveSettings(event: DidReceiveSettingsEvent<TSettings>): void
}
