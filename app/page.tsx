"use client";

import { useMachinesStore, useMachineStore } from "@/lib/core/stores";
import { defaultMachines as machs } from "@/lib/core/machines";
import { Button } from "@/components/ui/button";
import { Play, Pause, Settings, FileText, Info, Download, RefreshCw, Upload, Check, Clock, Hourglass, Trash, CalendarX, Star, AlertTriangle, Eye, CircleDot } from "lucide-react";
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardAction } from "@/components/ui/card";

export default function MachinesPage() {
  const { machines } = useMachinesStore();
  const { states } = useMachineStore();
  
  const machList = Object.values(machines)
    .filter((m: any) => !m.is_hidden())
    .sort((a: any, b: any) => {
      let cmp = (b.is_direct() ? 1 : 0) - (a.is_direct() ? 1 : 0);
      if (cmp) return cmp;
      cmp = (b.is_connected() ? 1 : 0) - (a.is_connected() ? 1 : 0);
      if (cmp) return cmp;
      return a.get_name().localeCompare(b.get_name());
    });

  const isEmpty = machList.length === 0;

  return (
    <div className="container mx-auto max-w-6xl py-6">
      
      {isEmpty ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center shadow-sm border-dashed my-4">
          <CardTitle className="mb-2 text-xl">No folding machines found.</CardTitle>
          <CardDescription className="text-base space-y-2">
            <p>Login or install the Folding@home client software.</p>
            <p>If you are using Brave browser, please use "Shields Down" for this site.</p>
          </CardDescription>
        </Card>
      ) : (
        <div>
          <Card className="mb-6" size="sm">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Total PPD</CardTitle>
              <CardAction>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => machs.set_state('fold')}
                    className="bg-green-600 hover:bg-green-700 text-white shadow-sm font-semibold"
                    title="Start folding on all machines"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Fold All
                  </Button>
                  <Button
                    onClick={() => machs.set_state('pause')}
                    variant="outline"
                    className="shadow-sm font-semibold border-primary/20 hover:bg-primary/5 text-primary"
                    title="Pause folding on all machines"
                  >
                    <Pause className="mr-2 h-4 w-4" />
                    Pause All
                  </Button>
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold tracking-tight">
                {machs.ppd.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {machList.map((mach: any) => (
              <MachineBlock key={mach.get_id()} mach={mach} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MachineBlock({ mach }: { mach: any }) {
  const { states } = useMachineStore();
  const connected = mach.is_connected();
  const title = mach.get_title();
  const name = mach.get_name();
  const version = mach.get_version();
  const isOutdated = mach.is_outdated();
  const resources = mach.get_resources('', 50);

  const isWarning = false;
  const statusLabels = [];
  if (!connected) {
    statusLabels.push("Disconnected");
  } else {
    if (isOutdated) statusLabels.push("Outdated");
    if (!mach.is_linked()) statusLabels.push("Unlinked");
    if (mach.is_empty()) statusLabels.push("No work");
  }

  const units = mach.get_units();
  const hasUnits = units.length > 0;

  return (
    <Card size="sm" className={`pb-0 transition-opacity ${!connected ? 'opacity-60' : ''} ${isWarning ? 'border-orange-500/50 ring-1 ring-orange-500/50' : ''}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <span className="font-semibold text-lg text-primary truncate" title={title}>
            {name}
          </span>
          {mach.is_direct() && <CircleDot className="h-3.5 w-3.5 text-muted-foreground ml-1" title="Direct Connection" />}
          {version && <span className="text-sm text-muted-foreground font-medium">v{version}</span>}
          {statusLabels.length > 0 && (
            <span className="text-sm text-orange-500 font-semibold ml-2">
              {statusLabels.join(", ")}
            </span>
          )}
        </CardTitle>
        <CardDescription className="truncate" title={mach.get_resources()}>
          {resources}
        </CardDescription>
        <CardAction>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" disabled={!mach.get_id() || isOutdated} title="Settings">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" disabled={!connected || isOutdated} title="Log">
              <FileText className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" disabled={!version || isOutdated} title="Details">
              <Info className="h-4 w-4" />
            </Button>
            {mach.is_paused() ? (
              <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" disabled={!connected || isOutdated} onClick={() => mach.set_state('fold')} title="Start folding">
                <Play className="h-5 w-5" />
              </Button>
            ) : (
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" disabled={!connected || isOutdated} onClick={() => mach.set_state('pause')} title="Pause folding">
                <Pause className="h-5 w-5" />
              </Button>
            )}
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="px-0">
        <Table className="[&_td]:py-1.5 [&_th]:h-8 [&_th]:py-1.5 text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="text-center w-[60px]">Status</TableHead>
              <TableHead className="w-[100px]">Project</TableHead>
              <TableHead className="text-right">Run Time</TableHead>
              <TableHead className="text-right">ETA</TableHead>
              <TableHead className="text-right">Base Credit</TableHead>
              <TableHead className="text-right">PPD</TableHead>
              <TableHead className="text-right">TPF</TableHead>
              <TableHead className="w-[200px]">Progress</TableHead>
              <TableHead className="text-right pr-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hasUnits ? (
              units.map((unit: any) => {
                // Map legacy FontAwesome icons to Lucide
                const getIcon = (iconName: string) => {
                  switch(iconName) {
                    case 'download': return <Download className="h-4 w-4 mx-auto text-blue-500" />;
                    case 'refresh': return <RefreshCw className="h-4 w-4 mx-auto text-green-500" />;
                    case 'upload': return <Upload className="h-4 w-4 mx-auto text-purple-500" />;
                    case 'check': return <Check className="h-4 w-4 mx-auto text-green-500" />;
                    case 'clock-o': return <Clock className="h-4 w-4 mx-auto text-orange-500" />;
                    case 'hourglass-o': return <Hourglass className="h-4 w-4 mx-auto text-orange-500" />;
                    case 'trash': return <Trash className="h-4 w-4 mx-auto text-red-500" />;
                    case 'calendar-times-o': return <CalendarX className="h-4 w-4 mx-auto text-red-500" />;
                    case 'star': return <Star className="h-4 w-4 mx-auto text-yellow-500" />;
                    case 'times':
                    default: return <AlertTriangle className="h-4 w-4 mx-auto text-muted-foreground" />;
                  }
                };

                return (
                  <TableRow key={unit.id}>
                    <TableCell className="text-center" title={unit.status_title}>
                      {getIcon(unit.icon)}
                    </TableCell>
                    <TableCell className="font-medium">{unit.project}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{unit.run_time}</TableCell>
                    <TableCell className="text-right text-muted-foreground" dangerouslySetInnerHTML={{__html: unit.eta}}></TableCell>
                    <TableCell className="text-right font-medium">{unit.base_credit}</TableCell>
                    <TableCell className="text-right font-medium text-foreground">{unit.ppd}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{unit.tpf}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-full bg-secondary rounded-sm overflow-hidden relative">
                          <div 
                            className={`h-full absolute left-0 top-0 transition-all duration-500 ${unit.paused ? 'bg-orange-500' : 'bg-green-500'}`}
                            style={{ width: `${unit.progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] w-10 font-medium">{unit.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:text-red-500" disabled={!unit.paused || !connected} onClick={() => { if(confirm("Are you sure you want to dump this Work Unit?")) mach.dump(unit.id) }} title="Dump Work Unit">
                          <Trash className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" disabled={!connected} title="View Work Unit log">
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" disabled={!unit.wu} title="View Work Unit details">
                          <Info className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" disabled={!unit.wu || !connected} title="View 3D protein">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : connected && !isOutdated ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                  {mach.is_empty() ? "No Work Units." : "Work Units loading..."}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
