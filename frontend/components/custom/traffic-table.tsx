import {
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ArrowDown, ArrowUp, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MobileSetupDialog } from "./mobile-setup-dialog";
import {
  formatBytes,
  formatTime,
  getMethodType,
  getPrimaryContentType,
  methodPillClassNames,
  tableColumns,
  type TableColumn,
  type ProxyDetails,
  type SortKey,
  type SortState,
  type TrafficEntry,
} from "./proxy-data";

type TrafficTableProps = {
  certURL: string;
  entries: TrafficEntry[];
  methodClassNames: Map<string, string>;
  proxyDetails: ProxyDetails;
  selectedID: number | null;
  sort: SortState;
  onOpen: (entry: TrafficEntry) => void;
  onPin: (entry: TrafficEntry) => void;
  onSort: (key: SortKey) => void;
};

type SortButtonProps = {
  column: TableColumn;
  onSort: (key: SortKey) => void;
  sort: SortState;
};

type TrafficRowProps = {
  entry: TrafficEntry;
  index: number;
  methodClassNames: Map<string, string>;
  onOpen: (entry: TrafficEntry) => void;
  onPin: (entry: TrafficEntry) => void;
  requestNumber: number;
  selected: boolean;
};

export function TrafficTable({
  certURL,
  entries,
  methodClassNames,
  proxyDetails,
  selectedID,
  sort,
  onOpen,
  onPin,
  onSort,
}: TrafficTableProps) {
  const [columnWidths, setColumnWidths] = useState(() =>
    Object.fromEntries(tableColumns.map((column) => [column.id, column.width])),
  );
  const flexColumnID = tableColumns[tableColumns.length - 1]?.id;
  const minTableWidth = useMemo(
    () =>
      tableColumns.reduce(
        (width, column) =>
          width +
          (column.id === flexColumnID
            ? (column.minWidth ?? column.width)
            : (columnWidths[column.id] ?? column.width)),
        0,
      ),
    [columnWidths, flexColumnID],
  );
  const requestNumbers = useMemo(
    () =>
      new Map(
        [...entries]
          .sort(
            (left, right) =>
              new Date(left.time).getTime() - new Date(right.time).getTime(),
          )
          .map((entry, index) => [entry.id, index + 1] as const),
      ),
    [entries],
  );

  function startColumnResize(
    column: TableColumn,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = columnWidths[column.id] ?? column.width;
    const minWidth = column.minWidth ?? 48;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onPointerMove(moveEvent: PointerEvent) {
      const nextWidth = Math.max(
        minWidth,
        Math.round(startWidth + moveEvent.clientX - startX),
      );

      setColumnWidths((current) => ({
        ...current,
        [column.id]: nextWidth,
      }));
    }

    function onPointerUp() {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  }

  return (
    <div className="min-h-0 flex-1">
      <Table
        className="table-fixed text-xs"
        containerClassName="h-full overflow-auto"
        style={{ minWidth: minTableWidth }}
      >
        <colgroup>
          {tableColumns.map((column) => {
            const resizable = column.id !== flexColumnID;

            return (
              <col
                key={column.id}
                style={
                  resizable
                    ? { width: columnWidths[column.id] ?? column.width }
                    : undefined
                }
              />
            );
          })}
        </colgroup>

        <TableHeader className="sticky top-0 z-10 bg-muted/60 [&_tr]:border-b-0">
          <TableRow className="border-b-0 hover:bg-transparent">
            {tableColumns.map((column) => (
              <TableHead key={column.id} className={headClassName(column)}>
                <div
                  className={[
                    "flex h-full items-center px-2 pr-3",
                    column.align === "right" ? "justify-end" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {column.sortKey ? (
                    <SortButton column={column} sort={sort} onSort={onSort} />
                  ) : (
                    <span>{column.label}</span>
                  )}
                </div>

                {column.id !== flexColumnID ? (
                  <Button
                    aria-label={`Resize ${column.label} column`}
                    title={`Resize ${column.label} column`}
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="absolute top-0 right-0 h-full w-2 cursor-col-resize rounded-none px-0 hover:bg-muted"
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => startColumnResize(column, event)}
                  />
                ) : null}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {entries.length === 0 ? (
            <EmptyTable certURL={certURL} proxyDetails={proxyDetails} />
          ) : (
            entries.map((entry, index) => (
              <TrafficRow
                entry={entry}
                index={index}
                key={entry.id}
                methodClassNames={methodClassNames}
                requestNumber={requestNumbers.get(entry.id) ?? index + 1}
                selected={selectedID === entry.id}
                onOpen={onOpen}
                onPin={onPin}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function SortButton({ column, onSort, sort }: SortButtonProps) {
  const active = sort.key === column.sortKey;
  return (
    <Button
      variant="ghost"
      size="xs"
      className={[
        "h-6 px-0 text-xs hover:bg-transparent",
        column.align === "right" ? "ml-auto" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => column.sortKey && onSort(column.sortKey)}
    >
      {column.label}
      {active && sort.direction === "asc" ? (
        <ArrowUp className="size-3" />
      ) : null}
      {active && sort.direction === "desc" ? (
        <ArrowDown className="size-3" />
      ) : null}
    </Button>
  );
}

function TrafficRow({
  entry,
  index,
  methodClassNames,
  onOpen,
  onPin,
  requestNumber,
  selected,
}: TrafficRowProps) {
  const method = getMethodType(entry);
  return (
    <TableRow
      className="cursor-pointer border-b-0 odd:bg-card even:bg-muted/30 hover:bg-muted data-[state=selected]:bg-muted"
      data-state={selected ? "selected" : undefined}
      onClick={() => onOpen(entry)}
      onContextMenu={(event) => {
        event.preventDefault();
        onPin(entry);
      }}
    >
      <TableCell className="px-2 py-1 text-right text-muted-foreground">
        {requestNumber}
      </TableCell>

      <TableCell className="px-2 py-1 whitespace-nowrap">
        {formatTime(entry.time)}
      </TableCell>

      <TableCell className="px-2 py-1">
        <span
          className={[
            "inline-flex max-w-full items-center px-2 py-0.5 text-[11px] font-semibold ring-1",
            methodClassNames.get(method) ?? methodPillClassNames[0],
          ].join(" ")}
        >
          <span className="truncate">{method}</span>
        </span>
      </TableCell>

      <TableCell className="truncate px-2 py-1">
        {getPrimaryContentType(entry)}
      </TableCell>

      <TableCell className="truncate px-2 py-1">{entry.host}</TableCell>

      <TableCell className="truncate px-2 py-1">
        {entry.error || entry.url}
      </TableCell>

      <TableCell className="truncate px-2 py-1 text-right">
        {entry.status || "-"}
      </TableCell>

      <TableCell className="truncate px-2 py-1 text-right">
        {formatBytes(entry.bytes)}
      </TableCell>

      <TableCell className="truncate px-2 py-1 text-right">
        {entry.durationMs} ms
      </TableCell>

      <TableCell className="truncate px-2 py-1">{entry.client}</TableCell>
    </TableRow>
  );
}

function EmptyTable({
  certURL,
  proxyDetails,
}: {
  certURL: string;
  proxyDetails: ProxyDetails;
}) {
  return (
    <TableRow className="border-b-0">
      <TableCell
        colSpan={10}
        className="h-36 text-center text-muted-foreground"
      >
        <div className="flex flex-col items-center justify-center gap-3">
          <div>No traffic yet</div>
          <MobileSetupDialog
            certURL={certURL}
            proxyDetails={proxyDetails}
            trigger={
              <Button variant="outline">
                <Smartphone className="size-4" />
                Setup
              </Button>
            }
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

function headClassName(column: TableColumn) {
  return ["relative h-7 px-0", column.align === "right" ? "text-right" : ""]
    .filter(Boolean)
    .join(" ");
}
