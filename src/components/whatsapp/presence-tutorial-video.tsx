"use client";

import * as React from "react";

import { Play } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogPopup, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PRESENCE_WHATSAPP_COPY } from "@/features/waha-cadence/pairing-copy";

const VIDEO = {
  src: "/onboarding/video/tutorial-conectar-whatsapp.mp4",
  poster: "/onboarding/video/poster-tutorial-conectar-whatsapp.jpg",
};

/**
 * "Assistir tutorial" (06/11): the 90 s vertical video on connecting WhatsApp, in a floating
 * window over the connection screen, so the broker never leaves the page. Closing it stops it.
 */
export function PresenceTutorialVideo() {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="w-full" size="lg" variant="outline" />}>
        <Play className="size-4" /> {PRESENCE_WHATSAPP_COPY.watchTutorial}
      </DialogTrigger>
      <DialogPopup className="w-[min(92vw,calc(82dvh*9/16))] max-w-none p-ds-12">
        <DialogTitle className="sr-only">{PRESENCE_WHATSAPP_COPY.watchTutorial}</DialogTitle>
        <DialogDescription className="sr-only">{PRESENCE_WHATSAPP_COPY.tutorialDescription}</DialogDescription>
        {open ? (
          <video
            className="aspect-[9/16] w-full rounded-ds-cards bg-black object-contain"
            src={VIDEO.src}
            poster={VIDEO.poster}
            controls
            autoPlay
            playsInline
            preload="metadata"
          />
        ) : null}
      </DialogPopup>
    </Dialog>
  );
}
