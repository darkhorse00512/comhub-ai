import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Save, Undo2 } from "lucide-react";

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  onRevert: () => void;
  isSaving?: boolean;
}

const UnsavedChangesModal = ({
  isOpen,
  onClose,
  onSave,
  onRevert,
  isSaving = false,
}: UnsavedChangesModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <DialogTitle>Unsaved Changes</DialogTitle>
              <DialogDescription className="mt-1">
                You have unsaved changes that will be lost.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Would you like to save your changes before leaving, or revert to the last saved version?
          </p>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={onRevert}
            disabled={isSaving}
            className="flex-1"
          >
            <Undo2 className="w-4 h-4 mr-2" />
            Revert Changes
          </Button>
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UnsavedChangesModal;
