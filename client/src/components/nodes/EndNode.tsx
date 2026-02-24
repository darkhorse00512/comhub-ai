import { memo, useState } from "react";
import { FlagTriangleRight, Pencil, HelpCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { nodeDescriptions } from "@/data/nodeDescriptions";

interface ResultField {
  name: string;
  type: string;
  description: string;
  enumValues: string;
}

interface EndNodeProps {
  data: any;
  isConnectable?: boolean;
}

const RESULT_TYPES = [
  { value: "text", label: "Text" },
  { value: "integer", label: "Integer" },
  { value: "boolean", label: "Boolean" },
  { value: "real", label: "Real" },
  { value: "enum", label: "Enum" },
];

const EndNode = ({ data }: EndNodeProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [summaryPrompt, setSummaryPrompt] = useState(data.summaryPrompt || "");
  const [results, setResults] = useState<ResultField[]>(data.results || []);

  // Temp state for editing
  const [tempSummaryPrompt, setTempSummaryPrompt] = useState(summaryPrompt);
  const [tempResults, setTempResults] = useState<ResultField[]>(results);

  const handleOpenModal = () => {
    setTempSummaryPrompt(summaryPrompt);
    setTempResults(results.map((r) => ({ ...r })));
    setIsModalOpen(true);
  };

  const handleSave = () => {
    setSummaryPrompt(tempSummaryPrompt);
    setResults(tempResults);
    data.summaryPrompt = tempSummaryPrompt;
    data.results = tempResults;
    setIsModalOpen(false);
  };

  const handleCancel = () => {
    setTempSummaryPrompt(summaryPrompt);
    setTempResults(results.map((r) => ({ ...r })));
    setIsModalOpen(false);
  };

  const addResult = () => {
    setTempResults([
      ...tempResults,
      { name: "", type: "", description: "", enumValues: "" },
    ]);
  };

  const removeResult = (index: number) => {
    setTempResults(tempResults.filter((_, i) => i !== index));
  };

  const updateResult = (index: number, field: keyof ResultField, value: string) => {
    const updated = tempResults.map((r, i) =>
      i === index ? { ...r, [field]: value } : r
    );
    setTempResults(updated);
  };

  const configuredResults = results.filter((r) => r.name);

  return (
    <>
      <div className="bg-red-50 border-2 border-red-400 rounded-xl shadow-lg min-w-[300px] max-w-[600px] relative">
        <div className="p-4">
          {/* Header with Edit Button */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FlagTriangleRight className="w-5 h-5 text-red-600" />
              <span className="font-semibold text-red-900">End Call</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 opacity-60 hover:opacity-100 cursor-help ml-1 text-red-600" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="font-medium">
                      {nodeDescriptions.end_call?.tooltip ||
                        "Ends the workflow. Configure summary prompt and results extraction."}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <button
              onClick={handleOpenModal}
              className="p-1.5 rounded-lg hover:bg-red-200 transition-colors"
              title="Edit End Node"
            >
              <Pencil className="w-4 h-4 text-red-600" />
            </button>
          </div>

          {/* Preview Content */}
          <div className="space-y-2">
            {summaryPrompt ? (
              <div className="bg-gray-100 rounded-lg p-3 text-sm text-gray-700 line-clamp-3">
                {summaryPrompt}
              </div>
            ) : (
              <div className="bg-gray-100 rounded-lg p-3 text-sm text-gray-400">
                No summary prompt configured
              </div>
            )}

            {configuredResults.length > 0 && (
              <div className="bg-gray-100 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-600 mb-1.5">
                  Results Extraction ({configuredResults.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {configuredResults.map((r, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium border border-red-200"
                    >
                      {r.name}
                      {r.type && (
                        <span className="text-red-400 ml-1">({r.type})</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>End Call Configuration</DialogTitle>
            <DialogDescription>
              Configure the summary prompt and define the results to extract when the call ends.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Summary Prompt */}
            <div className="grid gap-2">
              <Label htmlFor="summaryPrompt">Summary Prompt</Label>
              <Textarea
                id="summaryPrompt"
                value={tempSummaryPrompt}
                onChange={(e) => setTempSummaryPrompt(e.target.value)}
                placeholder="Configure summary prompt..."
                className="min-h-[100px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Instructions for generating a conversation summary when the call ends.
              </p>
            </div>

            {/* Results Extraction */}
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <Label>Results Extraction</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addResult}
                  className="h-8"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Result
                </Button>
              </div>

              {tempResults.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
                  No results configured. Click "Add Result" to define fields to extract.
                </p>
              )}

              <div className="space-y-4">
                {tempResults.map((result, index) => (
                  <div
                    key={index}
                    className="border border-border rounded-lg p-4 relative bg-secondary/20"
                  >
                    <button
                      type="button"
                      onClick={() => removeResult(index)}
                      className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-red-100 text-red-500 hover:text-red-700 transition-colors"
                      title="Remove result"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="grid gap-3 pr-8">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                          <Label className="text-xs">Name</Label>
                          <Input
                            value={result.name}
                            onChange={(e) =>
                              updateResult(index, "name", e.target.value)
                            }
                            placeholder="e.g. customer_name"
                            className="h-9"
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={result.type}
                            onValueChange={(value) =>
                              updateResult(index, "type", value)
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {RESULT_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-1.5">
                        <Label className="text-xs">Description</Label>
                        <Textarea
                          value={result.description}
                          onChange={(e) =>
                            updateResult(index, "description", e.target.value)
                          }
                          placeholder="Enter a description for this result..."
                          className="min-h-[60px] resize-none text-sm"
                          rows={2}
                        />
                      </div>

                      {result.type === "enum" && (
                        <div className="grid gap-1.5">
                          <Label className="text-xs">
                            Values (comma separated)
                          </Label>
                          <Input
                            value={result.enumValues}
                            onChange={(e) =>
                              updateResult(index, "enumValues", e.target.value)
                            }
                            placeholder="value1, value2, value3"
                            className="h-9"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(EndNode);
