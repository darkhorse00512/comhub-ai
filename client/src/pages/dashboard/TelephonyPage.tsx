import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Phone,
  Settings2,
  Plus,
  ShoppingCart,
  Upload,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Globe,
  ChevronRight,
  Trash2,
  MoreVertical,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";

interface PhoneNumber {
  id: string;
  phone_number: string;
  friendly_name?: string;
  country?: string;
  country_code?: string;
  status: "active" | "pending" | "inactive";
  type: "purchased" | "imported";
  created_at: string;
  twilio_capabilities?: {
    voice?: boolean;
    sms?: boolean;
  };
}

const TelephonyPage = () => {
  const { toast } = useToast();
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showSipGuide, setShowSipGuide] = useState(false);
  const [addMethod, setAddMethod] = useState<"purchase" | "import" | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Import form state
  const [importForm, setImportForm] = useState({
    accountSid: "",
    authToken: "",
    phoneNumberSid: "",
  });

  // Purchase form state
  const [purchaseForm, setPurchaseForm] = useState({
    countryCode: "US",
    areaCode: "",
    voiceEnabled: true,
    smsEnabled: false,
  });

  // Available numbers state
  const [availableNumbers, setAvailableNumbers] = useState<any[]>([]);
  const [searchingNumbers, setSearchingNumbers] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);

  // Fetch phone numbers on mount
  useEffect(() => {
    fetchPhoneNumbers();
  }, []);

  const fetchPhoneNumbers = async () => {
    setLoading(true);
    try {
      const response = await api.getPhoneNumbers();
      if (response.error) {
        toast({
          title: "Error",
          description: response.error,
          variant: "destructive",
        });
      } else {
        setPhoneNumbers(response.data || []);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch phone numbers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchNumbers = async () => {
    if (!purchaseForm.countryCode) {
      toast({
        title: "Validation Error",
        description: "Please select a country",
        variant: "destructive",
      });
      return;
    }

    setSearchingNumbers(true);
    try {
      const response = await api.searchAvailableNumbers(
        purchaseForm.countryCode,
        purchaseForm.areaCode || undefined,
        { voice: purchaseForm.voiceEnabled, sms: purchaseForm.smsEnabled }
      );

      if (response.error) {
        toast({
          title: "Search Failed",
          description: response.error,
          variant: "destructive",
        });
        setAvailableNumbers([]);
      } else {
        setAvailableNumbers(response.data || []);
        if (response.data && response.data.length > 0) {
          const message = (response as any).message;
          toast({
            title: "Success",
            description: message || `Found ${response.data.length} available numbers`,
          });
        } else {
          toast({
            title: "No Numbers Found",
            description: "Try different search criteria or a different country",
            variant: "destructive",
          });
        }
      }
    } finally {
      setSearchingNumbers(false);
    }
  };

  const handlePurchaseNumber = async () => {
    if (!selectedNumber) {
      toast({
        title: "Validation Error",
        description: "Please select a number to purchase",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    try {
      const response = await api.purchasePhoneNumber(
        selectedNumber,
        purchaseForm.countryCode
      );

      if (response.error) {
        toast({
          title: "Purchase Failed",
          description: response.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Phone number purchased successfully",
        });
        // Reset form and dialog
        setPurchaseForm({
          countryCode: "US",
          areaCode: "",
          voiceEnabled: true,
          smsEnabled: false,
        });
        setAvailableNumbers([]);
        setSelectedNumber(null);
        setAddMethod(null);
        setShowAddDialog(false);
        // Refresh phone numbers list
        await fetchPhoneNumbers();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleImportNumber = async () => {
    if (!importForm.accountSid || !importForm.authToken || !importForm.phoneNumberSid) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    try {
      const response = await api.importPhoneNumber(
        importForm.accountSid,
        importForm.authToken,
        importForm.phoneNumberSid
      );

      if (response.error) {
        toast({
          title: "Import Failed",
          description: response.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Phone number imported successfully",
        });
        // Reset form and dialog
        setImportForm({
          accountSid: "",
          authToken: "",
          phoneNumberSid: "",
        });
        setAddMethod(null);
        setShowAddDialog(false);
        // Refresh phone numbers list
        await fetchPhoneNumbers();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteNumber = async (id: string) => {
    try {
      const response = await api.deletePhoneNumber(id);

      if (response.error) {
        toast({
          title: "Delete Failed",
          description: response.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Phone number deleted successfully",
        });
        // Update local state
        setPhoneNumbers(phoneNumbers.filter((p) => p.id !== id));
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete phone number",
        variant: "destructive",
      });
    } finally {
      setDeleteConfirm(null);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
      toast({
        title: "Copied",
        description: "Copied to clipboard",
      });
    } catch (err) {
      console.error("Copy failed:", err);
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-foreground mb-2">Telephony</h1>
        <p className="text-muted-foreground">
          Manage your phone numbers and SIP configuration
        </p>
      </motion.div>

      {/* Main Cards */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Phone Numbers Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="h-full bg-card/50 backdrop-blur border-border/50 hover:border-primary/30 transition-colors cursor-pointer group">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Phone className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl">Phone Numbers</CardTitle>
                  <CardDescription>
                    Manage your phone numbers, purchase new ones, and configure settings
                  </CardDescription>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active numbers</span>
                <span className="font-semibold text-foreground">
                  {phoneNumbers.filter((p) => p.status === "active").length}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* SIP Configuration Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card
            className="h-full bg-card/50 backdrop-blur border-border/50 hover:border-primary/30 transition-colors cursor-pointer group"
            onClick={() => setShowSipGuide(true)}
          >
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                  <Settings2 className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl">SIP Configuration</CardTitle>
                  <CardDescription>
                    Configure SIP connection settings to connect your agents via SIP
                  </CardDescription>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-blue-500 transition-colors" />
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="w-full">
                <Settings2 className="w-4 h-4 mr-2" />
                SIP Configuration Guide
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Phone Numbers List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Your Phone Numbers</CardTitle>
              <CardDescription>
                Manage all your phone numbers in one place
              </CardDescription>
            </div>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Phone Number
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Phone Number</DialogTitle>
                  <DialogDescription>
                    Choose how you'd like to add a phone number:
                  </DialogDescription>
                </DialogHeader>

                {!addMethod ? (
                  <div className="grid gap-4 py-4">
                    {/* Purchase Option */}
                    <div
                      onClick={() => setAddMethod("purchase")}
                      className="p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-2 rounded-lg bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                          <ShoppingCart className="w-5 h-5 text-green-500" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground mb-1">
                            Purchase new number
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Buy a new phone number through Twilio. Quick and easy setup with immediate availability.
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary mt-1" />
                      </div>
                    </div>

                    {/* Import Option */}
                    <div
                      onClick={() => setAddMethod("import")}
                      className="p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                          <Upload className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground mb-1">
                            Import existing number
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Import a phone number from your own Twilio account. You'll
                            need your Twilio credentials and phone number SID.
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary mt-1" />
                      </div>
                    </div>
                  </div>
                ) : addMethod === "purchase" ? (
                  <div className="py-4 space-y-4">
                    {/* Info about address requirements */}
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm">
                      <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">📍 Note on Number Availability</p>
                      <p className="text-blue-700 dark:text-blue-300">
                        Some countries (like Germany, France) require address verification for regulatory compliance.
                        Numbers requiring verification are automatically filtered out.
                        <strong className="block mt-1">Recommended: US, GB, CA, AU</strong>
                      </p>
                    </div>

                    {/* Step 1: Search Criteria */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="countryCode">Country</Label>
                        <select
                          id="countryCode"
                          className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
                          value={purchaseForm.countryCode}
                          onChange={(e) =>
                            setPurchaseForm({ ...purchaseForm, countryCode: e.target.value })
                          }
                        >
                          <option value="US">🇺🇸 United States (+1) - Recommended</option>
                          <option value="GB">🇬🇧 United Kingdom (+44) - Recommended</option>
                          <option value="CA">🇨🇦 Canada (+1) - Recommended</option>
                          <option value="AU">🇦🇺 Australia (+61) - Recommended</option>
                          <option value="DE">🇩🇪 Germany (+49) - May require verification</option>
                          <option value="FR">🇫🇷 France (+33) - May require verification</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="areaCode">Area Code (Optional)</Label>
                        <Input
                          id="areaCode"
                          placeholder="e.g., 415 for San Francisco"
                          value={purchaseForm.areaCode}
                          onChange={(e) =>
                            setPurchaseForm({ ...purchaseForm, areaCode: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Capabilities</Label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={purchaseForm.voiceEnabled}
                              onChange={(e) =>
                                setPurchaseForm({
                                  ...purchaseForm,
                                  voiceEnabled: e.target.checked,
                                })
                              }
                              className="w-4 h-4"
                            />
                            <span className="text-sm">Voice calls</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={purchaseForm.smsEnabled}
                              onChange={(e) =>
                                setPurchaseForm({
                                  ...purchaseForm,
                                  smsEnabled: e.target.checked,
                                })
                              }
                              className="w-4 h-4"
                            />
                            <span className="text-sm">SMS messages</span>
                          </label>
                        </div>
                      </div>
                      <Button
                        className="w-full"
                        onClick={handleSearchNumbers}
                        disabled={searchingNumbers}
                      >
                        {searchingNumbers ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Searching...
                          </>
                        ) : (
                          "Search Numbers"
                        )}
                      </Button>
                    </div>

                    {/* Step 2: Available Numbers List */}
                    {availableNumbers.length > 0 && (
                      <div className="space-y-2">
                        <Label>Available Numbers</Label>
                        <div className="max-h-60 overflow-y-auto space-y-2 border border-border rounded-md p-2">
                          {availableNumbers.map((number) => (
                            <label
                              key={number.phoneNumber}
                              className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
                            >
                              <input
                                type="radio"
                                name="selectedNumber"
                                value={number.phoneNumber}
                                checked={selectedNumber === number.phoneNumber}
                                onChange={(e) => setSelectedNumber(e.target.value)}
                                className="mt-1 w-4 h-4"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-mono font-semibold text-foreground">
                                  {number.phoneNumber}
                                </p>
                                <div className="text-xs text-muted-foreground space-y-0.5">
                                  {number.locality && (
                                    <p>Location: {number.locality}{number.region ? `, ${number.region}` : ''}</p>
                                  )}
                                  {number.capabilities && (
                                    <p>
                                      Capabilities: {[
                                        number.capabilities.voice && 'Voice',
                                        number.capabilities.sms && 'SMS',
                                        number.capabilities.mms && 'MMS'
                                      ].filter(Boolean).join(', ')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setAddMethod(null);
                          setAvailableNumbers([]);
                          setSelectedNumber(null);
                        }}
                        disabled={importing}
                      >
                        Back
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={handlePurchaseNumber}
                        disabled={importing || !selectedNumber}
                      >
                        {importing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Purchasing...
                          </>
                        ) : (
                          "Purchase Selected Number"
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="py-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="accountSid">Twilio Account SID</Label>
                      <Input
                        id="accountSid"
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={importForm.accountSid}
                        onChange={(e) =>
                          setImportForm({ ...importForm, accountSid: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="authToken">Twilio Auth Token</Label>
                      <Input
                        id="authToken"
                        type="password"
                        placeholder="Your Twilio Auth Token"
                        value={importForm.authToken}
                        onChange={(e) =>
                          setImportForm({ ...importForm, authToken: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumberSid">Phone Number SID</Label>
                      <Input
                        id="phoneNumberSid"
                        placeholder="PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={importForm.phoneNumberSid}
                        onChange={(e) =>
                          setImportForm({ ...importForm, phoneNumberSid: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => setAddMethod(null)}
                        disabled={importing}
                      >
                        Back
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={handleImportNumber}
                        disabled={importing}
                      >
                        {importing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          "Import Number"
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 animate-spin" />
                <p className="text-sm text-muted-foreground">
                  Loading phone numbers...
                </p>
              </div>
            ) : phoneNumbers.length === 0 ? (
              <div className="text-center py-12">
                <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-2">
                  No phone numbers yet
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add your first phone number to start making calls
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Phone Number
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {phoneNumbers.map((phone) => (
                  <div
                    key={phone.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Phone className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-mono font-semibold text-foreground">
                          {phone.phone_number}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{phone.country || phone.country_code || "Unknown"}</span>
                          <span>•</span>
                          <span className="capitalize">{phone.type}</span>
                          {phone.twilio_capabilities?.voice && (
                            <>
                              <span>•</span>
                              <span>Voice</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          phone.status === "active"
                            ? "bg-green-500/10 text-green-500"
                            : phone.status === "pending"
                            ? "bg-yellow-500/10 text-yellow-500"
                            : "bg-red-500/10 text-red-500"
                        }`}
                      >
                        {phone.status}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => copyToClipboard(phone.phone_number, phone.id)}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Number
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteConfirm(phone.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* SIP Configuration Guide Dialog */}
      <Dialog open={showSipGuide} onOpenChange={setShowSipGuide}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              SIP Configuration Guide
            </DialogTitle>
            <DialogDescription>
              Configure your SIP connection to connect agents via SIP
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Connection Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                SIP Connection Setup
              </h3>
              <div className="p-4 rounded-xl bg-secondary/30 space-y-3">
                <h4 className="font-medium text-foreground">Connection Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Username:</span>
                    <span className="font-mono text-foreground">
                      your agent's phone number (e.g., +49XXXXXXXXX)
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Password:</span>
                    <span className="font-mono text-foreground">
                      the generated password for your group
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* SIP Domains */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">
                SIP Domains (Regional Routing Recommended)
              </h3>
              <p className="text-sm text-muted-foreground">
                Preferred non-legacy edge hostnames:
              </p>
              <div className="space-y-2">
                {[
                  {
                    region: "Germany (Frankfurt)",
                    domain: "comhubai.pstn.frankfurt.twilio.com",
                    flag: "🇩🇪",
                  },
                  {
                    region: "Ireland (Dublin)",
                    domain: "comhubai.pstn.dublin.twilio.com",
                    flag: "🇮🇪",
                  },
                  {
                    region: "United States (Ashburn)",
                    domain: "comhubai.pstn.ashburn.twilio.com",
                    flag: "🇺🇸",
                  },
                  {
                    region: "United States (Umatilla)",
                    domain: "comhubai.pstn.umatilla.twilio.com",
                    flag: "🇺🇸",
                  },
                ].map((item) => (
                  <div
                    key={item.domain}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{item.flag}</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {item.region}
                        </p>
                        <p className="text-xs font-mono text-muted-foreground">
                          {item.domain}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(item.domain, item.domain)}
                    >
                      {copied === item.domain ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Example SIP URIs */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Example SIP URIs</h3>
              <div className="space-y-2">
                {[
                  {
                    region: "Germany",
                    uri: "sip:+49XXXXXXXXX@comhubai.pstn.frankfurt.twilio.com",
                  },
                  {
                    region: "Ireland",
                    uri: "sip:+353XXXXXXXXX@comhubai.pstn.dublin.twilio.com",
                  },
                  {
                    region: "US",
                    uri: "sip:+1XXXXXXXXXX@comhubai.pstn.ashburn.twilio.com",
                  },
                ].map((item) => (
                  <div
                    key={item.uri}
                    className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/10"
                  >
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        {item.region}
                      </p>
                      <p className="text-sm font-mono text-foreground break-all">
                        {item.uri}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 ml-2"
                      onClick={() => copyToClipboard(item.uri, item.uri)}
                    >
                      {copied === item.uri ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Notice */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-foreground mb-1">Security</h4>
                  <p className="text-sm text-muted-foreground">
                    TLS is recommended for encrypted connections. Choose the domain that
                    matches your phone number's country for proper data compliance.
                  </p>
                  <a
                    href="https://www.twilio.com/docs/sip-trunking"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-500 hover:underline mt-2"
                  >
                    Learn more in Twilio docs
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this phone number from your account. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeleteNumber(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TelephonyPage;
