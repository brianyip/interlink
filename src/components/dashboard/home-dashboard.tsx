"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { useSession } from "@/lib/auth-client";

const exampleLinks = [
  {
    id: "1",
    key: "chasesapphirepreferred",
    displayText: "Chase Sapphire Preferred",
    url: "https://example.com",
    status: "active" as const,
  },
  {
    id: "2",
    key: "smartertravel",
    displayText: "Smarter Travel Card", 
    url: "https://example.com",
    status: "active" as const,
  }
];

export function HomeDashboard() {
  const [copied, setCopied] = useState(false);
  const { data: session } = useSession();

  const jsSnippet = session?.user?.id 
    ? `<script src="https://interlink-pi.vercel.app/js/interlink.min.js" data-user-id="${session.user.id}" defer></script>`
    : `<script src="https://interlink-pi.vercel.app/js/interlink.min.js" data-user-id="Loading..." defer></script>`;

  const handleCopy = async () => {
    // Don't allow copying until user ID is loaded
    if (!session?.user?.id) {
      return;
    }

    try {
      await navigator.clipboard.writeText(jsSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy text: ', error);
      // Could show a toast notification here for better UX
    }
  };

  return (
    <div className="flex-1 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl mb-2">Welcome to Interlink</h1>
        <p className="text-gray-600">
          Get started by adding the Interlink script to your website and managing your link references.
        </p>
      </div>

      <div className="space-y-8">
        {/* Step 1: Add JS Snippet */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                1
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Add JS snippet to your website</CardTitle>
                <CardDescription>
                  Copy and paste this script tag into your website&apos;s HTML head section.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative max-w-md">
              <pre className="bg-gray-50 border rounded-lg p-4 text-sm overflow-x-auto max-w-md whitespace-nowrap">
                <code className="text-gray-800">{jsSnippet}</code>
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="absolute top-2 right-2"
                onClick={handleCopy}
                disabled={!session?.user?.id}
              >
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Example Links Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                2
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Manage your links</CardTitle>
                <CardDescription>
                  Create and manage your link references that can be dynamically replaced on your website.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-gray-50 border-b border-gray-200">
                  <TableRow>
                    <TableHead className="p-4 text-sm text-gray-600">Key</TableHead>
                    <TableHead className="p-4 text-sm text-gray-600">Display Text</TableHead>
                    <TableHead className="p-4 text-sm text-gray-600">Link</TableHead>
                    <TableHead className="p-4 text-sm text-gray-600">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exampleLinks.map((link, index) => (
                    <TableRow
                      key={link.id}
                      className={`border-b border-gray-100 ${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                      }`}
                    >
                      <TableCell className="p-4">
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                          {`{{${link.key}}}`}
                        </code>
                      </TableCell>
                      <TableCell className="p-4">
                        <span className="truncate">{link.displayText}</span>
                      </TableCell>
                      <TableCell className="p-4 max-w-md">
                        <span className="truncate text-blue-600">{link.url}</span>
                      </TableCell>
                      <TableCell className="p-4">
                        <Badge
                          variant={link.status === "active" ? "default" : "secondary"}
                          className={`${
                            link.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          <div
                            className={`w-2 h-2 rounded-full mr-2 ${
                              link.status === "active" ? "bg-green-500" : "bg-gray-400"
                            }`}
                          />
                          {link.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: How it works */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                3
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">How it works</CardTitle>
                <CardDescription>
                  Interlink automatically finds and replaces text patterns in your webpage with dynamic content.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Step 1: Finds Text */}
              <div className="flex items-start gap-4">
                <div className="text-2xl">🔍</div>
                <div className="flex-1">
                  <h4 className="text-sm mb-2">
                    <strong>
                      Finds placeholder text patterns
                    </strong>
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Searches for text like{" "}
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{`{{chasesapphirepreferred}}`}</code>{" "}
                    in your webpage
                  </p>
                  <div className="bg-gray-50 p-3 rounded border-l-4 border-blue-200">
                    <p className="text-sm text-gray-700">
                      <strong>Your content:</strong>
                      <br />
                      <code className="text-sm">
                        Earn rewards with the{" "}
                        {`{{chasesapphirepreferred}}`}
                      </code>
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2: Replaces with Display Text */}
              <div className="flex items-start gap-4">
                <div className="text-2xl">🔗</div>
                <div className="flex-1">
                  <h4 className="text-sm mb-2">
                    <strong>Replaces with display text</strong>
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Matches the key from your links table and
                    replaces with the display text
                  </p>
                  <div className="bg-green-50 p-3 rounded border-l-4 border-green-200">
                    <p className="text-sm text-gray-700">
                      <strong>Becomes:</strong>
                      <br />
                      <span className="text-sm">
                        Earn rewards with the{" "}
                        <strong>
                          Chase Sapphire Preferred
                        </strong>
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 3: Optional Links */}
              <div className="flex items-start gap-4">
                <div className="text-2xl">✅</div>
                <div className="flex-1">
                  <h4 className="text-sm mb-2">
                    <strong>
                      Creates clickable links (optional)
                    </strong>
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    If a URL is provided in your links table,
                    the text becomes a clickable link
                  </p>
                  <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-200">
                    <p className="text-sm text-gray-700">
                      <strong>With URL becomes:</strong>
                      <br />
                      <span className="text-sm">
                        Earn rewards with the{" "}
                        <a
                          href="#"
                          className="text-blue-600 underline"
                        >
                          Chase Sapphire Preferred
                        </a>
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}