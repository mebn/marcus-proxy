import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileSetupDialog } from "./mobile-setup-dialog";
import type { ProxyDetails } from "./proxy-data";

type EmptyTrafficStateProps = {
  certURL: string;
  proxyDetails: ProxyDetails;
};

export function EmptyTrafficState({
  certURL,
  proxyDetails,
}: EmptyTrafficStateProps) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-4">
      <div className="grid justify-items-center gap-3 text-center">
        <div className="text-sm text-muted-foreground">
          No traffic captured. Setup may be needed.
        </div>
        <MobileSetupDialog
          certURL={certURL}
          proxyDetails={proxyDetails}
          trigger={
            <Button variant="outline" className="active:translate-y-px">
              <Smartphone className="size-4" />
              Setup
            </Button>
          }
        />
      </div>
    </div>
  );
}
