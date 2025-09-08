import { NextRequest, NextResponse } from 'next/server';
import { ingestFile, getSupportedFileTypes, getMaxFileSize } from '@/lib/ingestion/core';
import { IngestionResult, IngestionOptions } from '@/lib/ingestion/types';

/**
 * API Response types for proper TypeScript typing
 */
interface IngestionApiResponse {
  success: true;
  ingestionId: string;
  result: IngestionResult;
}

interface IngestionApiError {
  success: false;
  error: {
    type: string;
    message: string;
    suggestions?: string[];
    retryable?: boolean;
    retryDelay?: number;
  };
  ingestionId?: string;
}

/**
 * CORS headers for cross-origin requests
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

/**
 * Handle file ingestion POST requests
 */
export async function POST(request: NextRequest): Promise<NextResponse<IngestionApiResponse | IngestionApiError>> {
  try {
    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    // Basic file validation
    if (!file) {
      return NextResponse.json<IngestionApiError>(
        {
          success: false,
          error: {
            type: 'validation_error',
            message: 'No file provided in the request. Please include a file in the "file" field.',
            suggestions: [
              'Ensure you are sending a POST request with multipart/form-data',
              'Include a file in the form field named "file"',
              'Check that the file is not empty'
            ]
          }
        },
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    // Validate file has a name
    if (!file.name || file.name.trim() === '') {
      return NextResponse.json<IngestionApiError>(
        {
          success: false,
          error: {
            type: 'validation_error',
            message: 'File must have a valid filename.',
            suggestions: [
              'Ensure the uploaded file has a proper filename with extension',
              'Check that the file is not corrupted'
            ]
          }
        },
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    // Validate file size (basic check before detailed processing)
    const maxFileSize = getMaxFileSize();
    if (file.size > maxFileSize) {
      return NextResponse.json<IngestionApiError>(
        {
          success: false,
          error: {
            type: 'file_too_large',
            message: `File "${file.name}" is too large. Maximum file size is ${maxFileSize / (1024 * 1024)}MB, but file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`,
            suggestions: [
              'Try compressing the file using a ZIP utility',
              'Convert the document to a more efficient format',
              'Remove unnecessary images or media from the document',
              'Split large documents into smaller sections'
            ]
          }
        },
        { 
          status: 413,
          headers: corsHeaders
        }
      );
    }

    // Validate file type (basic check)
    const supportedTypes = getSupportedFileTypes();
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!supportedTypes.includes(fileExtension as (typeof supportedTypes)[number])) {
      return NextResponse.json<IngestionApiError>(
        {
          success: false,
          error: {
            type: 'unsupported_file_type',
            message: `File type "${fileExtension}" is not supported. Please use one of the supported formats: ${supportedTypes.join(', ')}.`,
            suggestions: [
              'Convert your file to a supported format (.txt, .pdf, .docx, .fdx, .celtx)',
              'If this is a script, try exporting as Final Draft (.fdx) or PDF',
              'For presentations, use PowerPoint (.pptx) or convert to PDF'
            ]
          }
        },
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    // Convert file to buffer for processing
    let fileBuffer: Buffer;
    try {
      fileBuffer = Buffer.from(await file.arrayBuffer());
    } catch {
      return NextResponse.json<IngestionApiError>(
        {
          success: false,
          error: {
            type: 'file_corrupted',
            message: `Unable to read file "${file.name}". The file may be corrupted.`,
            suggestions: [
              'Try re-uploading the file',
              'Check if the file opens correctly in its native application',
              'Convert the file to a different format and try again'
            ]
          }
        },
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    // Extract optional parameters from form data
    const priorityParam = formData.get('priority') as string;
    const userIdParam = formData.get('userId') as string;
    const projectIdParam = formData.get('projectId') as string;
    const sessionIdParam = formData.get('sessionId') as string;

    // Set up ingestion options
    const options: IngestionOptions = {
      priority: ['low', 'medium', 'high', 'urgent'].includes(priorityParam) 
        ? (priorityParam as 'low' | 'medium' | 'high' | 'urgent') 
        : 'medium',
      extractMetadata: true,
      validateContent: true,
      performSecurityScan: false, // Disable for now, can be enabled based on requirements
      timeout: 30000, // 30 second timeout
      userContext: {
        ...(userIdParam && { userId: userIdParam }),
        ...(projectIdParam && { projectId: projectIdParam }),
        ...(sessionIdParam && { sessionId: sessionIdParam })
      }
    };

    // Process the file through the core ingestion engine
    const ingestionResult = await ingestFile(
      file.name,
      fileBuffer,
      file.type || undefined,
      options
    );

    // Handle failed ingestion
    if (!ingestionResult.success || ingestionResult.error) {
      return NextResponse.json<IngestionApiError>(
        {
          success: false,
          ingestionId: ingestionResult.ingestionId,
          error: {
            type: ingestionResult.error?.type || 'unknown_error',
            message: ingestionResult.error?.message || 'An unknown error occurred during file processing.',
            suggestions: ingestionResult.error?.suggestions,
            retryable: ingestionResult.error?.retryable,
            retryDelay: ingestionResult.error?.retryDelay
          }
        },
        { 
          status: ingestionResult.error?.type === 'file_too_large' ? 413 :
                  ingestionResult.error?.type === 'unsupported_file_type' ? 400 :
                  ingestionResult.error?.type === 'timeout_error' ? 408 :
                  ingestionResult.error?.retryable ? 503 : 500,
          headers: corsHeaders
        }
      );
    }

    // Return successful ingestion result
    return NextResponse.json<IngestionApiResponse>(
      {
        success: true,
        ingestionId: ingestionResult.ingestionId,
        result: ingestionResult
      },
      {
        status: 200,
        headers: corsHeaders
      }
    );

  } catch (error) {
    console.error('Ingestion API error:', error);
    
    // Handle unexpected errors
    return NextResponse.json<IngestionApiError>(
      {
        success: false,
        error: {
          type: 'internal_server_error',
          message: 'An internal server error occurred while processing your file.',
          suggestions: [
            'Please try again in a few moments',
            'If the problem persists, contact support',
            'Check if the file is corrupted or in an unusual format'
          ],
          retryable: true,
          retryDelay: 10000
        }
      },
      { 
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

/**
 * Handle unsupported HTTP methods
 */
export async function GET() {
  return NextResponse.json<IngestionApiError>(
    {
      success: false,
      error: {
        type: 'method_not_allowed',
        message: 'GET method is not supported for this endpoint. Use POST to upload files.',
        suggestions: [
          'Use POST method to upload files',
          'Include the file in multipart/form-data format',
          'Check the API documentation for proper usage'
        ]
      }
    },
    { 
      status: 405,
      headers: {
        ...corsHeaders,
        'Allow': 'POST, OPTIONS'
      }
    }
  );
}