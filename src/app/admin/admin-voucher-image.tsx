'use client'
import * as React from "react"
import { useMutation } from "convex/react"
import { FaWhatsapp } from "react-icons/fa"

import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/use-toast"
import { voucherImageUrl } from "@/lib/voucher/image-url"
import { api } from "../../../convex/_generated/api"
import { secondaryActionClass } from "./_components/voucher-sheet"

const loadErrorMessage = "Não foi possível carregar a imagem do voucher. Tente novamente em instantes."

type VoucherImage = { file: File; objectUrl: string }

/**
 * The customer's voucher image (same `/api/og` render as Meus Vouchers) with
 * "Baixar" and "Enviar". Fetches the voucher's lookup capability as an admin
 * when mounted, then the PNG once; the preview, download and share all reuse
 * that file, so "Enviar" calls the share sheet straight from the click (iOS
 * rejects sharing after an awaited fetch). `version` must change whenever the
 * image content does (status, expiry). The app never sends anything:
 * "Enviar" opens the share sheet, or downloads the PNG and opens the
 * customer's WhatsApp chat so the admin can attach it.
 */
export function AdminVoucherImage({
  code,
  phone,
  version,
}: {
  code: string
  phone: string
  version: string
}) {
  const getToken = useMutation(api.vouchers.adminImageToken)
  const [lookupToken, setLookupToken] = React.useState<string | null>(null)
  const [image, setImage] = React.useState<VoucherImage | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true
    setLookupToken(null)
    setError(null)
    getToken({ code })
      .then((result) => {
        if (!active) return
        if (result) setLookupToken(result.lookupToken)
        else setError(loadErrorMessage)
      })
      .catch(() => {
        if (active) setError(loadErrorMessage)
      })
    return () => {
      active = false
    }
  }, [code, getToken])

  const fileName = `voucher-${code}.png`

  React.useEffect(() => {
    if (!lookupToken) return
    let active = true
    let objectUrl: string | null = null
    setImage(null)
    setError(null)
    fetch(voucherImageUrl(code, lookupToken, version))
      .then(async (response) => {
        if (!response.ok) throw new Error(`image request failed: ${response.status}`)
        const blob = await response.blob()
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setImage({ file: new File([blob], fileName, { type: "image/png" }), objectUrl })
      })
      .catch(() => {
        if (active) setError(loadErrorMessage)
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [code, fileName, lookupToken, version])

  async function handleSend() {
    if (!image) return
    try {
      if (navigator.canShare?.({ files: [image.file] })) {
        await navigator.share({ files: [image.file] })
        return
      }
      const link = document.createElement("a")
      link.href = image.objectUrl
      link.download = fileName
      link.click()
      window.open(`https://wa.me/${phone}`, "_blank")
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return
      toast({
        title: "Não foi possível compartilhar a imagem. Tente baixar e enviar manualmente.",
        variant: "destructive",
      })
    }
  }

  if (error) {
    return <p role="alert" className="text-sm text-destructive">{error}</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- server-generated, non-optimizable OG image
        <img src={image.objectUrl} alt={`Voucher ${code}`} className="w-full rounded-lg" />
      ) : (
        <Skeleton className="aspect-[2/1] w-full rounded-lg" />
      )}
      <div className="flex gap-2">
        {image ? (
          <a
            href={image.objectUrl}
            download={fileName}
            className={`${secondaryActionClass} flex flex-1 items-center justify-center`}
          >
            Baixar
          </a>
        ) : (
          <button type="button" className={`${secondaryActionClass} flex-1`} disabled>
            Baixar
          </button>
        )}
        <button
          type="button"
          className={`${secondaryActionClass} flex flex-1 items-center justify-center gap-2`}
          disabled={!image}
          onClick={() => void handleSend()}
        >
          <FaWhatsapp className="h-4 w-4" aria-hidden />
          Enviar
        </button>
      </div>
    </div>
  )
}
