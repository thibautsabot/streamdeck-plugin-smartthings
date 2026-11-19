import { GlobalSettingsInterface } from './interface'

export function isGlobalSettingsSet(
  settings: GlobalSettingsInterface | unknown,
): settings is GlobalSettingsInterface {
  const typed = settings as GlobalSettingsInterface | undefined | null
  return (
    typed?.oauthTokens !== undefined &&
    typed?.oauthClientId !== undefined &&
    typed?.oauthClientSecret !== undefined
  )
}

export interface ApiError extends Error {
  status: number
  statusText: string
}

interface FetchAPI {
  body?: BodyInit
  endpoint: string
  method: string
  accessToken: string
}

export async function fetchApi<T>({ body, endpoint, method, accessToken }: FetchAPI): Promise<T> {
  let response: Response
  try {
    response = await fetch(`https://api.smartthings.com/v1${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body,
    })
  } catch (networkError) {
    // offline, DNS, TLS... no HTTP status to report
    console.error(`[API] ${method} ${endpoint} network error:`, networkError)
    throw networkError
  }
  if (!response.ok) {
    console.error(
      `[API] ${method} ${endpoint} failed: HTTP ${response.status} ${response.statusText}`,
    )
    const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as ApiError
    error.status = response.status
    error.statusText = response.statusText
    throw error
  }

  return await response.json()
}

export interface SelectElement {
  id?: string
  name?: string
}
interface AddSelectOption {
  select: HTMLSelectElement
  element: SelectElement
}

export const addSelectOption = ({ select, element }: AddSelectOption): void => {
  if (element.id && element.name) {
    const option = document.createElement('option')
    option.value = element.id
    option.text = element.name.slice(0, 30) // limit to 30 char to avoid display bug in the PI
    select.add(option)
  }
}
