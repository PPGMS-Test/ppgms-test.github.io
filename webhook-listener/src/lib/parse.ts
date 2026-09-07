/**
 * Best-effort parsing of PayPal webhook event body.
 * Tries to extract event_type and resource_type from a JSON body.
 * Non-JSON bodies or bodies missing these fields are handled gracefully.
 */

export interface ParsedEvent {
  event_type: string | null
  resource_type: string | null
}

export function parseWebhookBody(rawBody: string): ParsedEvent {
  try {
    const json = JSON.parse(rawBody)
    const event_type = typeof json.event_type === 'string' ? json.event_type : null
    const resource_type =
      json.resource && typeof json.resource === 'object' && json.resource !== null
        ? typeof json.resource.resource_type === 'string'
          ? json.resource.resource_type
          : null
        : null
    return { event_type, resource_type }
  } catch {
    // Body is not valid JSON — leave both fields null
    return { event_type: null, resource_type: null }
  }
}