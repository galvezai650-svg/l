import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    const zai = await ZAI.create();
    const result = await zai.functions.invoke('page_reader', {
      url: parsedUrl.href,
    });

    if (result.code !== 200 && result.code !== 20000) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch page (status: ${result.code})`,
        },
        { status: 502 }
      );
    }

    const data = result.data;
    const htmlContent = data.html || '';
    const plainText = htmlContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract links from HTML
    const linkRegex = /href=["'](https?:\/\/[^"']+)["']/g;
    const links: string[] = [];
    let match;
    while ((match = linkRegex.exec(htmlContent)) !== null) {
      links.push(match[1]);
    }

    // Extract images from HTML
    const imgRegex = /src=["'](https?:\/\/[^"']+\.(jpg|jpeg|png|gif|webp|svg|ico))[""]/gi;
    const images: string[] = [];
    while ((match = imgRegex.exec(htmlContent)) !== null) {
      images.push(match[1]);
    }

    return NextResponse.json({
      success: true,
      data: {
        title: data.title || 'No title',
        url: data.url || parsedUrl.href,
        html: htmlContent,
        plainText,
        publishedTime: data.publishedTime || null,
        description: data.description || null,
        links: [...new Set(links)],
        images: [...new Set(images)],
        wordCount: plainText.split(/\s+/).filter((w: string) => w.length > 0).length,
        htmlSize: htmlContent.length,
        warning: data.warning || null,
        tokensUsed: data.usage?.tokens || 0,
      },
    });
  } catch (error) {
    console.error('Page viewer error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
