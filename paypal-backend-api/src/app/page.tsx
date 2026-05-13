'use client'

// @ts-ignore - swagger-ui-react types incompatible with React 19
import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'

export default function Home() {
  // @ts-ignore
  return <SwaggerUI url="/openapi.json" />
}
