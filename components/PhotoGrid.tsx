import Image from 'next/image'
import { LoopingClip } from '@/components/LoopingClip'
import { isCaptionEmpty } from '@/lib/captions'
import { listPhotos } from '@/lib/photos'

/**
 * The photography grid on /about.
 *
 * Same photographs and same captions as the pond, read from the same place —
 * `listPhotos()` joined to captions.json. Describing a photograph once and
 * having it appear correctly in both places is the entire reason the captions
 * live in a data file rather than in the markup.
 *
 * What it deliberately does NOT show is the exposure line. At a tile width of
 * about 160px, three lines of text under every picture is a wall of grey; the
 * exposure is the most subordinate of the three and it is the one that goes.
 * It is still there in the pond, where a photograph opens large enough to
 * carry it, and it is still in every tile's screen-reader description.
 */
export function PhotoGrid() {
  const photos = listPhotos()

  if (photos.length === 0) {
    return (
      <p className="my-3 font-mono text-small text-muted">
        [photographs go here — drop them in public/photos and run
        npm run photos:sync]
      </p>
    )
  }

  return (
    <ul className="my-3 grid grid-cols-2 gap-1 sm:grid-cols-3">
      {photos.map((photo) => (
        <li key={photo.file}>
          <figure className="m-0">
            <div className="relative aspect-square overflow-hidden">
              {photo.video ? (
                <LoopingClip
                  src={photo.video}
                  // The poster is the file the optimiser has already resized;
                  // a clip tile should not pull a full-size still.
                  poster={photo.src}
                  alt={photo.caption.alt}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <Image
                  src={photo.original}
                  alt={photo.caption.alt}
                  fill
                  sizes="(max-width: 640px) 50vw, 200px"
                  className="object-cover"
                />
              )}
            </div>
            {!isCaptionEmpty(photo.caption) && (
              <figcaption className="mt-0.5">
                {photo.caption.headline && (
                  <span className="block font-mono text-tiny text-muted">
                    {photo.caption.headline}
                  </span>
                )}
                {photo.caption.line && (
                  <span className="block font-mono text-tiny text-ink">
                    {photo.caption.line}
                  </span>
                )}
              </figcaption>
            )}
          </figure>
        </li>
      ))}
    </ul>
  )
}
