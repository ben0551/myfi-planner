import { LoginForm } from './LoginForm'

export default function LoginPage() {
  const hasGoogle = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  const hasMicrosoft = Boolean(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET)
  return <LoginForm hasGoogle={hasGoogle} hasMicrosoft={hasMicrosoft} />
}
