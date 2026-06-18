import type { ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { ProxyDetails } from "./proxy-data";

type MobileSetupDialogProps = {
  certURL: string;
  proxyDetails: ProxyDetails;
  trigger: ReactNode;
};

type SetupStepProps = { number: string; title: string; children: ReactNode };
type LabeledValueProps = { label: string; value: string };

export function MobileSetupDialog({
  certURL,
  proxyDetails,
  trigger,
}: MobileSetupDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="select-none sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mobile Setup</DialogTitle>
          <DialogDescription>
            Wi-Fi proxy and root certificate.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <SetupStep number="1" title="Set Wi-Fi proxy">
            <div className="text-muted-foreground">
              Open phone Wi-Fi network settings, choose manual proxy, use host
              and port below.
            </div>
            <div className="mt-2 grid gap-2 border p-3 sm:grid-cols-2">
              <LabeledValue label="Host" value={proxyDetails.host} />
              <LabeledValue label="Port" value={proxyDetails.port} />
            </div>
          </SetupStep>

          <Separator />

          <SetupStep number="2" title="Install certificate">
            <div className="text-muted-foreground">
              Scan QR code or open URL on phone.
            </div>
            <div className="mt-2 grid justify-items-center gap-3 border p-4">
              <div className="flex size-44 items-center justify-center bg-white p-2">
                {certURL ? (
                  <QRCodeSVG value={certURL} size={160} level="M" />
                ) : (
                  <div className="size-40 bg-muted" />
                )}
              </div>
              <div className="max-w-full break-all text-center text-xs text-muted-foreground">
                {certURL || "Certificate URL unavailable"}
              </div>
            </div>
          </SetupStep>

          <Separator />

          <SetupStep number="3" title="Trust certificate">
            <div className="text-muted-foreground">
              Enable full trust for certificate in settings.
            </div>
          </SetupStep>
        </div>
      </DialogContent>
    </Dialog>
  );
}
function SetupStep({ number, title, children }: SetupStepProps) {
  return (
    <div className="grid grid-cols-[2rem_1fr] gap-3 text-sm">
      <div className="flex size-8 items-center justify-center border text-xs">
        {number}
      </div>

      <div>
        <div className="font-medium">{title}</div>
        {children}
      </div>
    </div>
  );
}

function LabeledValue({ label, value }: LabeledValueProps) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="break-all">{value}</div>
    </div>
  );
}
