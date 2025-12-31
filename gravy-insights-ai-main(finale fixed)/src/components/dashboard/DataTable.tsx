import { ViewType } from "@/pages/Dashboard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface DataTableProps {
  viewType: Exclude<ViewType, "analytics" | "campaigns">;
}

export const DataTable = ({ viewType }: DataTableProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, any>>({});
  const [isFirstEntryDialogOpen, setIsFirstEntryDialogOpen] = useState(false);
  const [firstEntryFields, setFirstEntryFields] = useState<{ key: string; value: string }[]>([
    { key: "", value: "" },
  ]);

  const { data: sheetData, isLoading, error: queryError } = useQuery({
    queryKey: [viewType],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-sheet-data", {
        body: { sheet: viewType }
      });
      if (error) {
        console.error(`Error fetching sheet data for ${viewType}:`, error);
        throw error;
      }
      if (data?.error) {
        console.error(`Sheet data error for ${viewType}:`, data.error);
        throw new Error(data.error);
      }
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.functions.invoke("update-sheet-data", {
        body: { sheet: viewType, id, updates }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [viewType] });
      setEditingRow(null);
      toast({ title: "Updated successfully" });
    },
    onError: () => {
      toast({ title: "Update failed", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke("delete-sheet-data", {
        body: { sheet: viewType, id }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [viewType] });
      toast({
        title: "Row deleted",
        description: "Successfully deleted the row",
      });
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const { error } = await supabase.functions.invoke("add-sheet-data", {
        body: { sheet: viewType, data }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [viewType] });
      setIsAddDialogOpen(false);
      setNewRowData({});
      setIsFirstEntryDialogOpen(false);
      setFirstEntryFields([{ key: "", value: "" }]);
      toast({
        title: "Row added",
        description: "Successfully added new row",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (queryError) {
    return (
      <div className="text-center py-12 border rounded-lg bg-card">
        <p className="text-destructive font-semibold mb-2">Error loading data</p>
        <p className="text-muted-foreground text-sm">
          {queryError instanceof Error ? queryError.message : 'Failed to fetch sheet data'}
        </p>
        <p className="text-muted-foreground text-xs mt-2">
          Please check that the sheet name is correct in Google Sheets
        </p>
      </div>
    );
  }

  const columns = sheetData?.headers ?? [];
  const rows = sheetData?.rows ?? [];
  const isCompletelyEmpty = columns.length === 0 && rows.length === 0;

  if (isCompletelyEmpty) {
    return (
      <div className="text-center py-12 border rounded-lg bg-card">
        <p className="text-muted-foreground">No data available</p>
        <Dialog open={isFirstEntryDialogOpen} onOpenChange={setIsFirstEntryDialogOpen}>
          <DialogTrigger asChild>
            <Button className="mt-4" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add First Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add First Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 text-left">
              {firstEntryFields.map((field, index) => (
                <div key={index} className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Column Name</label>
                    <Input
                      value={field.key}
                      onChange={(e) => {
                        const updated = [...firstEntryFields];
                        updated[index] = { ...updated[index], key: e.target.value };
                        setFirstEntryFields(updated);
                      }}
                      placeholder="e.g. Availability"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Value</label>
                    <Input
                      value={field.value}
                      onChange={(e) => {
                        const updated = [...firstEntryFields];
                        updated[index] = { ...updated[index], value: e.target.value };
                        setFirstEntryFields(updated);
                      }}
                      placeholder="Enter value"
                    />
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setFirstEntryFields([...firstEntryFields, { key: "", value: "" }])
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Column
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsFirstEntryDialogOpen(false);
                  setFirstEntryFields([{ key: "", value: "" }]);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const payload: Record<string, any> = {};
                  firstEntryFields.forEach(({ key, value }) => {
                    const trimmedKey = key.trim();
                    if (trimmedKey) {
                      payload[trimmedKey] = value;
                    }
                  });

                  if (Object.keys(payload).length === 0) {
                    toast({
                      title: "Please add at least one column",
                      variant: "destructive",
                    });
                    return;
                  }

                  addMutation.mutate(payload);
                }}
                disabled={addMutation.isPending}
              >
                {addMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                Add Entry
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add New Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {columns.map((column) => (
                <div key={column} className="space-y-2">
                  <label className="text-sm font-medium">{column.replace(/_/g, ' ').toUpperCase()}</label>
                  <Input
                    value={newRowData[column] || ''}
                    onChange={(e) => setNewRowData({ ...newRowData, [column]: e.target.value })}
                    placeholder={`Enter ${column}`}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setIsAddDialogOpen(false);
                setNewRowData({});
              }}>
                Cancel
              </Button>
              <Button 
                onClick={() => addMutation.mutate(newRowData)}
                disabled={addMutation.isPending}
              >
                {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Add Entry
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col} className="font-semibold">
                {col.replace(/_/g, ' ').toUpperCase()}
              </TableHead>
            ))}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground">
                No data available. Use "Add New Entry" to create the first row.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row: any, idx: number) => (
              <TableRow key={row.id || idx}>
                {columns.map((col) => (
                  <TableCell key={col}>
                    {editingRow === row.id ? (
                      <Input
                        value={editData[col] ?? row[col]}
                        onChange={(e) =>
                          setEditData({ ...editData, [col]: e.target.value })
                        }
                        className="h-8"
                      />
                    ) : (
                      <span>{row[col]}</span>
                    )}
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {editingRow === row.id ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            updateMutation.mutate({ id: row.id, updates: editData })
                          }
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingRow(null);
                            setEditData({});
                          }}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingRow(row.id);
                            setEditData(row);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(row.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  );
};
