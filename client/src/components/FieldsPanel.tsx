import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Database, Hash, Type, ToggleLeft, AlertCircle } from "lucide-react";
import { Node } from "@/components/FlowCanvas";

interface FieldsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node[];
}

interface FieldInfo {
  name: string;
  type: "text" | "number" | "boolean";
  nodeId: string;
  nodeLabel: string;
  defaultValue?: string;
}

const FieldsPanel = ({ isOpen, onClose, nodes }: FieldsPanelProps) => {
  const [fields, setFields] = useState<FieldInfo[]>([]);

  // Extract fields from field_setter nodes
  useEffect(() => {
    const extractedFields: FieldInfo[] = [];

    nodes.forEach((node) => {
      if (node.type === "field_setter") {
        const fieldName = node.data?.fieldName;
        if (fieldName) {
          extractedFields.push({
            name: fieldName,
            type: node.data?.valueType || "text",
            nodeId: node.id,
            nodeLabel: node.data?.label || "Field Setter",
            defaultValue: node.data?.value || "",
          });
        }
      }
    });

    // Also check for junction conditions (they reference fields)
    nodes.forEach((node) => {
      if (node.type === "junction") {
        const conditionField = node.data?.left?.field_name || node.data?.conditionField;
        if (conditionField && !extractedFields.find(f => f.name === conditionField)) {
          extractedFields.push({
            name: conditionField,
            type: "text",
            nodeId: node.id,
            nodeLabel: node.data?.label || "Junction",
            defaultValue: "",
          });
        }
      }
    });

    // Check switch nodes
    nodes.forEach((node) => {
      if (node.type === "switch") {
        const switchField = node.data?.switchField;
        if (switchField && !extractedFields.find(f => f.name === switchField)) {
          extractedFields.push({
            name: switchField,
            type: "text",
            nodeId: node.id,
            nodeLabel: node.data?.label || "Switch",
            defaultValue: "",
          });
        }
      }
    });

    setFields(extractedFields);
  }, [nodes]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "number":
        return <Hash className="w-4 h-4" />;
      case "boolean":
        return <ToggleLeft className="w-4 h-4" />;
      default:
        return <Type className="w-4 h-4" />;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "number":
        return "bg-blue-100 text-blue-700";
      case "boolean":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-green-100 text-green-700";
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-500" />
            Workflow Fields
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6">
          <p className="text-sm text-muted-foreground mb-4">
            Fields are variables collected and used throughout your workflow. They are defined in Field Setter nodes and can be referenced in conditions.
          </p>

          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Fields Defined</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Add Field Setter nodes to your workflow to define fields that can collect and store information during calls.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-3 pr-4">
                {fields.map((field, index) => (
                  <div
                    key={`${field.nodeId}-${index}`}
                    className="p-4 rounded-lg border border-gray-200 bg-white hover:border-purple-300 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded ${getTypeBadgeColor(field.type)}`}>
                          {getTypeIcon(field.type)}
                        </div>
                        <span className="font-mono font-semibold text-gray-900">
                          {field.name}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {field.type}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      <span>Defined in: </span>
                      <span className="font-medium text-gray-700">{field.nodeLabel}</span>
                    </div>

                    {field.defaultValue && (
                      <div className="mt-2 text-xs">
                        <span className="text-muted-foreground">Default: </span>
                        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                          {field.defaultValue}
                        </code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <div className="mt-6 p-4 rounded-lg bg-purple-50 border border-purple-200">
            <h4 className="text-sm font-medium text-purple-900 mb-2">How to use fields</h4>
            <ul className="text-xs text-purple-700 space-y-1">
              <li>• Use <code className="bg-purple-100 px-1 rounded">Field Setter</code> nodes to collect data</li>
              <li>• Reference fields in <code className="bg-purple-100 px-1 rounded">Junction</code> conditions</li>
              <li>• Use <code className="bg-purple-100 px-1 rounded">Switch</code> to branch based on field values</li>
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FieldsPanel;
