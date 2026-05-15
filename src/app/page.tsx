'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Globe,
  Search,
  Loader2,
  AlertCircle,
  ExternalLink,
  FileText,
  Code2,
  Eye,
  Link2,
  Image as ImageIcon,
  Clock,
  Hash,
  HardDrive,
  Zap,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

interface PageData {
  title: string;
  url: string;
  html: string;
  plainText: string;
  publishedTime: string | null;
  description: string | null;
  links: string[];
  images: string[];
  wordCount: number;
  htmlSize: number;
  warning: string | null;
  tokensUsed: number;
}

type ViewTab = 'preview' | 'html' | 'text';

export default function PageViewer() {
  const [url, setUrl] = useState('n186t36xxzf0-.space.z.ai');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('preview');
  const [copied, setCopied] = useState(false);
  const [linksExpanded, setLinksExpanded] = useState(false);
  const [imagesExpanded, setImagesExpanded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchPage = useCallback(async (targetUrl?: string) => {
    const fetchUrl = targetUrl || url;
    if (!fetchUrl.trim()) return;

    setLoading(true);
    setError(null);
    setPageData(null);

    try {
      const response = await fetch('/api/page-viewer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fetchUrl }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to fetch page');
        return;
      }

      setPageData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [url]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchPage();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      fetchPage();
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderPreview = () => {
    if (!pageData?.html) {
      return (
        <div className="flex items-center justify-center h-full min-h-[400px] text-muted-foreground">
          <div className="text-center space-y-2">
            <FileText className="h-12 w-12 mx-auto opacity-40" />
            <p>No HTML content to preview</p>
          </div>
        </div>
      );
    }

    return (
      <div className="relative w-full h-full min-h-[500px] rounded-lg border border-border overflow-hidden bg-white">
        <iframe
          ref={iframeRef}
          srcDoc={pageData.html}
          className="w-full h-full min-h-[500px] border-0"
          sandbox="allow-same-origin"
          title="Page Preview"
        />
      </div>
    );
  };

  const renderHtmlSource = () => {
    if (!pageData?.html) {
      return (
        <div className="flex items-center justify-center h-full min-h-[400px] text-muted-foreground">
          <div className="text-center space-y-2">
            <Code2 className="h-12 w-12 mx-auto opacity-40" />
            <p>No HTML source available</p>
          </div>
        </div>
      );
    }

    return (
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur-sm"
          onClick={() => handleCopy(pageData.html)}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
        <pre className="p-4 overflow-x-auto text-sm leading-relaxed bg-muted/30 rounded-lg border border-border">
          <code>{pageData.html}</code>
        </pre>
      </div>
    );
  };

  const renderPlainText = () => {
    if (!pageData?.plainText) {
      return (
        <div className="flex items-center justify-center h-full min-h-[400px] text-muted-foreground">
          <div className="text-center space-y-2">
            <FileText className="h-12 w-12 mx-auto opacity-40" />
            <p>No plain text content available</p>
          </div>
        </div>
      );
    }

    return (
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur-sm"
          onClick={() => handleCopy(pageData.plainText)}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
        <div className="p-4 text-sm leading-relaxed bg-muted/30 rounded-lg border border-border whitespace-pre-wrap">
          {pageData.plainText}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Globe className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-lg font-semibold hidden sm:block">Page Viewer</h1>
            </div>

            <div className="flex-1 flex items-center gap-2">
              <div className="relative flex-1 max-w-2xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter URL to view..."
                  className="pl-9 pr-4 h-10 bg-muted/50 border-border/50 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                />
              </div>
              <Button
                onClick={() => fetchPage()}
                disabled={loading || !url.trim()}
                className="h-10 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shrink-0"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">View</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-6 w-32" />
            </div>
            <Skeleton className="h-[500px] w-full rounded-lg" />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="py-8">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="font-semibold text-destructive">Failed to load page</h3>
                  <p className="text-sm text-muted-foreground">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchPage()}
                    className="mt-3"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Try Again
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Page Content */}
        {pageData && !loading && (
          <div className="space-y-6">
            {/* Page Header Info */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <h2 className="text-2xl font-bold tracking-tight truncate">
                    {pageData.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <a
                      href={pageData.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-emerald-600 transition-colors truncate max-w-md"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{pageData.url}</span>
                    </a>
                    {pageData.warning && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Server Error
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats Badges */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1.5 py-1 px-2.5">
                  <Hash className="h-3 w-3" />
                  {pageData.wordCount.toLocaleString()} words
                </Badge>
                <Badge variant="secondary" className="gap-1.5 py-1 px-2.5">
                  <HardDrive className="h-3 w-3" />
                  {formatSize(pageData.htmlSize)}
                </Badge>
                <Badge variant="secondary" className="gap-1.5 py-1 px-2.5">
                  <Link2 className="h-3 w-3" />
                  {pageData.links.length} links
                </Badge>
                <Badge variant="secondary" className="gap-1.5 py-1 px-2.5">
                  <ImageIcon className="h-3 w-3" />
                  {pageData.images.length} images
                </Badge>
                <Badge variant="secondary" className="gap-1.5 py-1 px-2.5">
                  <Zap className="h-3 w-3" />
                  {pageData.tokensUsed} tokens
                </Badge>
                {pageData.publishedTime && (
                  <Badge variant="secondary" className="gap-1.5 py-1 px-2.5">
                    <Clock className="h-3 w-3" />
                    {formatDate(pageData.publishedTime)}
                  </Badge>
                )}
              </div>
            </div>

            <Separator />

            {/* Main Layout: Content + Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
              {/* Content Area */}
              <div className="min-w-0">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ViewTab)}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="preview" className="gap-1.5">
                      <Eye className="h-4 w-4" />
                      Preview
                    </TabsTrigger>
                    <TabsTrigger value="html" className="gap-1.5">
                      <Code2 className="h-4 w-4" />
                      HTML Source
                    </TabsTrigger>
                    <TabsTrigger value="text" className="gap-1.5">
                      <FileText className="h-4 w-4" />
                      Plain Text
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="preview" className="mt-0">
                    {renderPreview()}
                  </TabsContent>
                  <TabsContent value="html" className="mt-0">
                    {renderHtmlSource()}
                  </TabsContent>
                  <TabsContent value="text" className="mt-0">
                    {renderPlainText()}
                  </TabsContent>
                </Tabs>
              </div>

              {/* Sidebar */}
              <div className="space-y-4 lg:space-y-4">
                {/* Page Info Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Page Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Title</span>
                      <span className="font-medium text-right max-w-[180px] truncate">
                        {pageData.title}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Words</span>
                      <span className="font-medium">{pageData.wordCount.toLocaleString()}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">HTML Size</span>
                      <span className="font-medium">{formatSize(pageData.htmlSize)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Published</span>
                      <span className="font-medium text-right">
                        {pageData.publishedTime
                          ? new Date(pageData.publishedTime).toLocaleDateString()
                          : 'N/A'}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tokens</span>
                      <span className="font-medium">{pageData.tokensUsed}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Links Card */}
                {pageData.links.length > 0 && (
                  <Card>
                    <CardHeader
                      className="pb-3 cursor-pointer"
                      onClick={() => setLinksExpanded(!linksExpanded)}
                    >
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Link2 className="h-4 w-4" />
                          Links ({pageData.links.length})
                        </CardTitle>
                        {linksExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </CardHeader>
                    {linksExpanded && (
                      <CardContent className="pt-0">
                        <ScrollArea className="max-h-64">
                          <div className="space-y-1.5">
                            {pageData.links.map((link, i) => (
                              <a
                                key={i}
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-emerald-600 transition-colors truncate py-0.5"
                              >
                                <ArrowUpRight className="h-3 w-3 shrink-0" />
                                <span className="truncate">{link}</span>
                              </a>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    )}
                  </Card>
                )}

                {/* Images Card */}
                {pageData.images.length > 0 && (
                  <Card>
                    <CardHeader
                      className="pb-3 cursor-pointer"
                      onClick={() => setImagesExpanded(!imagesExpanded)}
                    >
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          Images ({pageData.images.length})
                        </CardTitle>
                        {imagesExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </CardHeader>
                    {imagesExpanded && (
                      <CardContent className="pt-0">
                        <ScrollArea className="max-h-64">
                          <div className="space-y-2">
                            {pageData.images.map((img, i) => (
                              <div key={i} className="flex items-center gap-2 p-1.5 rounded-md bg-muted/50">
                                <img
                                  src={img}
                                  alt={`Image ${i + 1}`}
                                  className="h-10 w-10 rounded object-cover bg-muted"
                                />
                                <a
                                  href={img}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-muted-foreground hover:text-emerald-600 transition-colors truncate flex-1"
                                >
                                  {img.split('/').pop()?.substring(0, 30) || img}
                                </a>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    )}
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!pageData && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mb-6">
              <Globe className="h-10 w-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Enter a URL to View</h2>
            <p className="text-muted-foreground max-w-md mb-6">
              Paste any web page URL above to fetch, preview, and analyze its content including HTML source, plain text, links, and images.
            </p>
            <Button
              onClick={() => inputRef.current?.focus()}
              variant="outline"
              className="gap-2"
            >
              <Search className="h-4 w-4" />
              Enter URL
            </Button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Globe className="h-3 w-3" />
              Page Viewer &mdash; Powered by Z.ai Web Reader
            </span>
            <span>
              {pageData ? `Last fetched: ${new Date().toLocaleTimeString()}` : 'Ready'}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
