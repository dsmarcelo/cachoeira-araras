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

/**
 * The customer's voucher image (same `/api/og` render as Meus Vouchers) with
 * "Baixar" and "Enviar". Fetches the voucher's lookup capability as an admin
 * when mounted. `version` must change whenever the image content does
 * (status, expiry) so the browser refetches it. The app never sends anything:
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
  const [error, setError] = React.useState<string | null>(null)
  const [loaded, setLoaded] = React.useState(false)
  const [isSending, setIsSending] = React.useState(false)

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

  const imageUrl = lookupToken ? voucherImageUrl(code, lookupToken, version) : null
  const fileName = `voucher-${code}.png`

  // Show the skeleton again whenever the image URL changes (status/date change).
  React.useEffect(() => {
    setLoaded(false)
  }, [imageUrl])

  function downloadBlob(blob: Blob) {
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = objectUrl
    link.download = fileName
    link.click()
    URL.revokeObjectURL(objectUrl)
  }

  async function handleSend() {
    if (!imageUrl) return
    setIsSending(true)
    try {
      const response = await fetch(imageUrl)
      if (!response.ok) throw new Error("image fetch failed")
      const blob = await response.blob()
      const file = new File([blob], fileName, { type: "image/png" })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
      } else {
        downloadBlob(blob)
        window.open(`https://wa.me/${phone}`, "_blank")
      }
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return
      toast({
        title: "Não foi possível compartilhar a imagem. Tente baixar e enviar manualmente.",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  if (error) {
    return <p role="alert" className="text-sm text-destructive">{error}</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- server-generated, non-optimizable OG image
        <img
          src={imageUrl}
          alt={`Voucher ${code}`}
          className={loaded ? "w-full rounded-lg" : "hidden"}
          onLoad={() => setLoaded(true)}
          onError={() => setError(loadErrorMessage)}
        />
      ) : null}
      {!loaded ? <Skeleton className="aspect-[3/4] w-full rounded-lg" /> : null}
      <div className="flex gap-2">
        {loaded && imageUrl ? (
          <a href={imageUrl} download={fileName} className={`${secondaryActionClass} flex flex-1 items-center justify-center`}>
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
          disabled={!loaded || isSending}
          onClick={() => void handleSend()}
        >
          <FaWhatsapp className="h-4 w-4" />
          Enviar
        </button>
      </div>
    </div>
  )
}
