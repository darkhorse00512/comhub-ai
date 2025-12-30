import { useState } from "react";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PhoneNumber {
  id: string;
  number: string;
  country: string;
  status: "active" | "pending" | "inactive";
  type: "purchased" | "imported";
  createdAt: string;
}

const TelephonyPage = () => {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([
    {
      id: "1",
      number: "+4915888656842",
      country: "Germany",
      status: "active",
      type: "purchased",
      createdAt: "2024-01-15",
    },
  ]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showSipGuide, setShowSipGuide] = useState(false);
  const [addMethod, setAddMethod] = useState<"purchase" | "import" | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Import form state
  const [importForm, setImportForm] = useState({
    accountSid: "",
    authToken: "",
    phoneNumberSid: "",
  });

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
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const handleDeleteNumber = (id: string) => {
    setPhoneNumbers(phoneNumbers.filter((p) => p.id !== id));
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
                            Buy a new phone number through ComHub's Twilio account. Quick
                            and easy setup with immediate availability.
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
                  <div className="py-4">
                    <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 mb-4">
                      <p className="text-sm text-yellow-600 dark:text-yellow-400">
                        Phone number purchasing will be available soon. Please use the
                        import option for now.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setAddMethod(null)}
                      className="w-full"
                    >
                      Back
                    </Button>
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
                      <Button variant="outline" onClick={() => setAddMethod(null)}>
                        Back
                      </Button>
                      <Button className="flex-1">Import Number</Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {phoneNumbers.length === 0 ? (
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
                          {phone.number}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{phone.country}</span>
                          <span>•</span>
                          <span className="capitalize">{phone.type}</span>
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
                            onClick={() => copyToClipboard(phone.number, phone.id)}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Number
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteNumber(phone.id)}
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
    </div>
  );
};

export default TelephonyPage;
