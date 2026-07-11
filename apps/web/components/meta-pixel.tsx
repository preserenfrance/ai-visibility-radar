"use client";

import * as React from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";

const META_PIXEL_ID = "1701392964519793";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function MetaPixelRouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const didMount = React.useRef(false);
  const search = searchParams.toString();

  React.useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    window.fbq?.("track", "PageView");
  }, [pathname, search]);

  return null;
}

export function MetaPixel() {
  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');
`}
      </Script>
      <React.Suspense fallback={null}>
        <MetaPixelRouteTracker />
      </React.Suspense>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
