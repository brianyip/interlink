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
    url: "",
    status: "active" as const,
  },
  {
    id: "2",
    key: "smartertravel",
    displayText: "Smarter Travel Card", 
    url: "https://www.google.com",
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
                <CardTitle>Add JS snippet to your website</CardTitle>
                <CardDescription>
                  Copy and paste this script tag into your website&apos;s HTML head section.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="bg-gray-50 border rounded-lg p-4 text-sm overflow-x-auto">
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
            {session?.user?.id && (
              <p className="text-xs text-gray-500 mt-2">
                Your User ID: <span className="font-mono">{session.user.id}</span>
              </p>
            )}
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
                <CardTitle>Manage your links</CardTitle>
                <CardDescription>
                  Create and manage your link references that can be dynamically replaced on your website.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-gray-50/80 border-b border-gray-200">
                  <TableRow>
                    <TableHead className="p-4 text-sm font-medium text-gray-500">Key</TableHead>
                    <TableHead className="p-4 text-sm font-medium text-gray-500">Display Text</TableHead>
                    <TableHead className="p-4 text-sm font-medium text-gray-500">Link</TableHead>
                    <TableHead className="p-4 text-sm font-medium text-gray-500">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exampleLinks.map((link, index) => (
                    <TableRow
                      key={link.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50/20"
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
                          className={`flex items-center gap-2 ${
                            link.status === "active"
                              ? "bg-green-100 text-green-700 border-green-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          }`}
                        >
                          <div
                            className={`w-2 h-2 rounded-full ${
                              link.status === "active" ? "bg-green-600" : "bg-gray-400"
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
                <CardTitle>How it works</CardTitle>
                <CardDescription>
                  Interlink automatically replaces text patterns in your webpage with dynamic content.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                <div>
                  <p className="text-sm">
                    <strong>Finds text like</strong> <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">{`{{cardkey}}`}</code> <strong>in the webpage</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                <div>
                  <p className="text-sm">
                    <strong>Replaces with display text</strong> from user&apos;s links table
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                <div>
                  <p className="text-sm">
                    <strong>Can optionally create links</strong> if URL is provided
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}