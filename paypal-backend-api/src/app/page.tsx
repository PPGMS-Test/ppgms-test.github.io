import { ApiReference } from '@scalar/nextjs-api-reference'

export default function Home() {
  return (
    <ApiReference
      configuration={{
        url: '/openapi.json',
        pageTitle: 'PayPal Backend API',
        theme: 'default',
      }}
    />
  )
}
