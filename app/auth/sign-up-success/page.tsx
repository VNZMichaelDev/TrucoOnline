import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">¡Cuenta Creada!</CardTitle>
            <CardDescription>Revisa tu email para confirmar tu cuenta</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Te hemos enviado un email de confirmación. Haz clic en el enlace para activar tu cuenta y poder jugar.
            </p>
            <Link href="/auth/login" className="text-sm underline underline-offset-4">
              Volver al inicio de sesión
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
