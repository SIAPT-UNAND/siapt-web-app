import { useEffect, useState } from 'react';

export default function ReceiptImage({ src, pengenal, alt, className, style }) {
  const isProtectedApi = Boolean(src && src.startsWith('/api/'));
  const requestKey = `${src || ''}|${pengenal || ''}`;
  const [fetchResult, setFetchResult] = useState({ key: '', url: '', error: false });

  useEffect(() => {
    if (!src || !isProtectedApi) return undefined;

    let cancelled = false;
    let objectUrl = '';

    fetch(src, {
      cache: 'no-store',
      headers: pengenal ? { 'x-pengenal': pengenal } : {},
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        if (typeof res.blob === 'function') {
          const blob = await res.blob();
          if (typeof URL.createObjectURL === 'function') {
            objectUrl = URL.createObjectURL(blob);
            return objectUrl;
          }
        }
        return src;
      })
      .then((resolvedUrl) => {
        if (!cancelled) {
          setFetchResult({ key: requestKey, url: resolvedUrl, error: false });
        } else if (objectUrl && typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(objectUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetchResult({ key: requestKey, url: '', error: true });
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src, pengenal, isProtectedApi, requestKey]);

  if (!src) return null;
  if (!isProtectedApi) {
    return <img src={src} alt={alt} className={className} style={style} />;
  }

  const isCurrent = fetchResult.key === requestKey;
  if (isCurrent && fetchResult.error) {
    return (
      <span className="table-sub-text text-red">
        Gagal memuat gambar bukti pembayaran.
      </span>
    );
  }

  if (!isCurrent || !fetchResult.url) {
    return <span className="table-sub-text">Memuat gambar bukti...</span>;
  }

  return <img src={fetchResult.url} alt={alt} className={className} style={style} />;
}
