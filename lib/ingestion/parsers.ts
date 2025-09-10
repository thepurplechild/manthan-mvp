/**
 * Project Manthan OS - File Format Parsers
 * 
 * Individual parser functions for each supported file type.
 * Each parser extracts content and returns structured data.
 */

import { createHash } from 'crypto';
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import * as xml2js from 'xml2js';
import AdmZip from 'adm-zip';
import { promisify } from 'util';

import {
  IngestedContent,
  SupportedFileType,
  IngestionWarning,
  IngestionProgressCallback
} from './types';
import { logger } from './logger';

// Structured screenplay format
export interface StructuredScript {
  type: 'structured_script';
  scenes: ScriptScene[];
  metadata?: {
    title?: string;
    author?: string;
    characters?: string[];
    totalScenes?: number;
  };
}

export interface ScriptScene {
  heading: string;
  action: string;
  dialogue: DialogueLine[];
  sceneNumber?: number;
  location?: string;
  timeOfDay?: string;
}

export interface DialogueLine {
  character: string;
  line: string;
  parenthetical?: string;
}

/**
 * Base parser interface
 */
export interface ParseResult {
  textContent: string;
  structuredContent?: StructuredScript;
  metadata: IngestedContent['metadata'];
  warnings: IngestionWarning[];
}


/**
 * Basic metadata extraction from text content
 */
function extractBasicMetadata(
  filename: string,
  content: string
): IngestedContent['metadata'] {
  const lines = content.split('\n').filter(line => line.trim());
  const words = content.split(/\s+/).filter(word => word.length > 0);

  // Try to detect title from first few lines
  let title: string | undefined;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    if (line && line.length > 3 && line.length < 100 && !line.includes('\t')) {
      title = line;
      break;
    }
  }

  // Try to detect author
  let author: string | undefined;
  const authorPatterns = [
    /(?:by|written by|author|created by)[\s:]+([^\n\r]+)/i,
    /^([A-Z][a-z]+ [A-Z][a-z]+)$/m
  ];

  for (const pattern of authorPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      author = match[1].trim();
      break;
    }
  }

  return {
    title,
    author,
    pageCount: Math.ceil(content.length / 2500), // Rough estimate
    wordCount: words.length,
    charCount: content.length,
    language: 'en', // Default to English
    formatVersion: '1.0'
  };
}

/**
 * Text Parser (.txt)
 * Basic text file parser with encoding detection
 */
export async function parseTextFile(
  filename: string,
  buffer: Buffer,
  progressCallback?: IngestionProgressCallback
): Promise<ParseResult> {
  const warnings: IngestionWarning[] = [];
  
  try {
    progressCallback?.({
      currentStep: 'Parsing text file',
      progress: 20,
      details: 'Reading text content'
    });

    // Try UTF-8 first
    let content = buffer.toString('utf-8');
    
    // Check for encoding issues
    if (content.includes('\uFFFD')) {
      warnings.push({
        type: 'encoding_issues',
        message: 'Potential encoding issues detected, attempting alternative encodings',
        severity: 'medium',
        suggestions: ['Try saving the file as UTF-8', 'Check the original file encoding'],
        timestamp: new Date()
      });
      
      // Try other encodings
      try {
        content = buffer.toString('latin1');
      } catch {
        content = buffer.toString('ascii');
      }
    }

    progressCallback?.({
      currentStep: 'Extracting metadata',
      progress: 80,
      details: 'Analyzing content structure'
    });

    const metadata = extractBasicMetadata(filename, content);

    progressCallback?.({
      currentStep: 'Text parsing complete',
      progress: 100,
      details: `Extracted ${content.length} characters`
    });

    return {
      textContent: content,
      metadata,
      warnings
    };

  } catch (error) {
    throw new Error(`Text parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * PDF Parser (.pdf)
 * Uses pdf-parse library to extract text from PDF files
 */
export async function parsePdfFile(
  filename: string,
  buffer: Buffer,
  progressCallback?: IngestionProgressCallback
): Promise<ParseResult> {
  const warnings: IngestionWarning[] = [];
  
  try {
    progressCallback?.({
      currentStep: 'Parsing PDF file',
      progress: 20,
      details: 'Loading PDF document'
    });

    const pdfData = await pdfParse(buffer);

    progressCallback?.({
      currentStep: 'Extracting text content',
      progress: 60,
      details: `Processing ${pdfData.numpages} pages`
    });

    const content = pdfData.text;

    // Check for empty content
    if (!content || content.trim().length === 0) {
      warnings.push({
        type: 'empty_content',
        message: 'No text content could be extracted from the PDF',
        severity: 'high',
        suggestions: [
          'Check if the PDF contains text (not just images)',
          'Try using OCR if the PDF contains scanned images',
          'Ensure the PDF is not password-protected or corrupted'
        ],
        timestamp: new Date()
      });
    }

    // Check for potential password protection
    if (content.includes('password') || content.length < 50) {
      warnings.push({
        type: 'password_protected',
        message: 'PDF may be password-protected or have limited text content',
        severity: 'medium',
        suggestions: [
          'Remove password protection from the PDF',
          'Check if the PDF is primarily composed of images'
        ],
        timestamp: new Date()
      });
    }

    progressCallback?.({
      currentStep: 'Extracting metadata',
      progress: 80,
      details: 'Analyzing PDF metadata'
    });

    const metadata = extractBasicMetadata(filename, content);
    
    // Add PDF-specific metadata
    metadata.pageCount = pdfData.numpages;
    if (pdfData.info) {
      metadata.title = metadata.title || pdfData.info.Title;
      metadata.author = metadata.author || pdfData.info.Author;
      if (pdfData.info.CreationDate) {
        metadata.createdDate = new Date(pdfData.info.CreationDate);
      }
      if (pdfData.info.ModDate) {
        metadata.modifiedDate = new Date(pdfData.info.ModDate);
      }
    }

    progressCallback?.({
      currentStep: 'PDF parsing complete',
      progress: 100,
      details: `Extracted text from ${pdfData.numpages} pages`
    });

    return {
      textContent: content,
      metadata,
      warnings
    };

  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid PDF')) {
      throw new Error('Invalid or corrupted PDF file');
    }
    throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Final Draft Parser (.fdx)
 * Parses Final Draft XML format to extract structured screenplay data
 */
export async function parseFinalDraftFile(
  filename: string,
  buffer: Buffer,
  progressCallback?: IngestionProgressCallback
): Promise<ParseResult> {
  const warnings: IngestionWarning[] = [];
  
  try {
    progressCallback?.({
      currentStep: 'Parsing Final Draft file',
      progress: 20,
      details: 'Loading XML structure'
    });

    const xmlContent = buffer.toString('utf-8');
    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
    const parseXML = promisify(parser.parseString.bind(parser)) as (xml: string) => Promise<unknown>;

    const result = await parseXML(xmlContent);

    progressCallback?.({
      currentStep: 'Extracting screenplay structure',
      progress: 50,
      details: 'Processing scenes and dialogue'
    });

    // Extract FDX structure
    const fdxDocument = (result as any).FinalDraft;
    if (!fdxDocument) {
      throw new Error('Invalid Final Draft format: missing FinalDraft root element');
    }

    const content = fdxDocument.Content;
    const titlePage = fdxDocument.TitlePage;
    
    let textContent = '';
    const scenes: ScriptScene[] = [];
    let currentScene: Partial<ScriptScene> | null = null;
    const characters: Set<string> = new Set();

    // Extract title page information
    let scriptTitle = '';
    let scriptAuthor = '';
    
    if (titlePage && titlePage.Content && titlePage.Content.Paragraph) {
      const paragraphs = Array.isArray(titlePage.Content.Paragraph) 
        ? titlePage.Content.Paragraph 
        : [titlePage.Content.Paragraph];
      
      for (const para of paragraphs) {
        if (para.Text) {
          const text = typeof para.Text === 'string' ? para.Text : para.Text._ || '';
          if (!scriptTitle && text.length > 0) {
            scriptTitle = text;
          } else if (text.toLowerCase().includes('by')) {
            scriptAuthor = text.replace(/^by\s+/i, '').trim();
          }
        }
      }
    }

    // Process main content paragraphs
    if (content && content.Paragraph) {
      const paragraphs = Array.isArray(content.Paragraph) 
        ? content.Paragraph 
        : [content.Paragraph];

      for (const para of paragraphs) {
        const type = para.$.Type;
        const text = para.Text ? (typeof para.Text === 'string' ? para.Text : para.Text._ || '') : '';
        
        textContent += text + '\n';

        switch (type) {
          case 'Scene Heading':
            // Start new scene
            if (currentScene) {
              scenes.push(currentScene as ScriptScene);
            }
            currentScene = {
              heading: text,
              action: '',
              dialogue: [],
              location: extractLocation(text),
              timeOfDay: extractTimeOfDay(text)
            };
            break;

          case 'Action':
            if (currentScene) {
              currentScene.action += (currentScene.action ? '\n' : '') + text;
            }
            break;

          case 'Character':
            if (currentScene) {
              characters.add(text);
              // Dialogue will be processed in the next paragraph
            }
            break;

          case 'Dialogue':
            if (currentScene && currentScene.dialogue) {
              // Find the character from previous paragraph
              const lastCharacter = Array.from(characters).pop() || 'UNKNOWN';
              currentScene.dialogue.push({
                character: lastCharacter,
                line: text
              });
            }
            break;

          case 'Parenthetical':
            if (currentScene && currentScene.dialogue && currentScene.dialogue.length > 0) {
              const lastDialogue = currentScene.dialogue[currentScene.dialogue.length - 1];
              lastDialogue.parenthetical = text;
            }
            break;
        }
      }

      // Add the last scene
      if (currentScene) {
        scenes.push(currentScene as ScriptScene);
      }
    }

    progressCallback?.({
      currentStep: 'Building structured content',
      progress: 80,
      details: `Processed ${scenes.length} scenes`
    });

    // Build structured content
    const structuredContent: StructuredScript = {
      type: 'structured_script',
      scenes: scenes.map((scene, index) => ({
        ...scene,
        sceneNumber: index + 1
      })),
      metadata: {
        title: scriptTitle,
        author: scriptAuthor,
        characters: Array.from(characters),
        totalScenes: scenes.length
      }
    };

    const metadata = extractBasicMetadata(filename, textContent);
    metadata.title = scriptTitle || metadata.title;
    metadata.author = scriptAuthor || metadata.author;
    metadata.custom = {
      sceneCount: scenes.length,
      characterCount: characters.size,
      fdxVersion: fdxDocument.$.Version || 'unknown'
    };

    progressCallback?.({
      currentStep: 'Final Draft parsing complete',
      progress: 100,
      details: `Extracted ${scenes.length} scenes with ${characters.size} characters`
    });

    return {
      textContent,
      structuredContent,
      metadata,
      warnings
    };

  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid XML')) {
      throw new Error('Invalid or corrupted Final Draft file');
    }
    throw new Error(`Final Draft parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract location from scene heading
 */
function extractLocation(heading: string): string {
  const match = heading.match(/^(INT\.|EXT\.)\s+(.+?)\s+-\s+/i);
  return match ? match[2].trim() : '';
}

/**
 * Extract time of day from scene heading
 */
function extractTimeOfDay(heading: string): string {
  const match = heading.match(/\s+-\s+(.+)$/);
  return match ? match[1].trim() : '';
}

/**
 * Celtx Parser (.celtx)
 * Parses Celtx files (which are ZIP archives containing XML)
 */
export async function parseCeltxFile(
  filename: string,
  buffer: Buffer,
  progressCallback?: IngestionProgressCallback
): Promise<ParseResult> {
  const warnings: IngestionWarning[] = [];
  
  try {
    progressCallback?.({
      currentStep: 'Parsing Celtx file',
      progress: 20,
      details: 'Extracting archive contents'
    });

    // Celtx files are ZIP archives
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    // Look for the main script file (usually script-*.xml)
    let scriptEntry = entries.find(entry => 
      entry.entryName.startsWith('script-') && entry.entryName.endsWith('.xml')
    );

    if (!scriptEntry) {
      // Fallback to any XML file
      scriptEntry = entries.find(entry => entry.entryName.endsWith('.xml'));
    }

    if (!scriptEntry) {
      throw new Error('No script content found in Celtx file');
    }

    progressCallback?.({
      currentStep: 'Processing script content',
      progress: 50,
      details: 'Parsing XML structure'
    });

    const xmlContent = scriptEntry.getData().toString('utf-8');
    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
    const parseXML = promisify(parser.parseString.bind(parser)) as (xml: string) => Promise<unknown>;

    const result = await parseXML(xmlContent);

    // Process Celtx XML structure (similar to FDX but with different schema)
    let textContent = '';
    const scenes: ScriptScene[] = [];
    const characters: Set<string> = new Set();

    // Celtx has a different XML structure than FDX
    // This is a simplified parser - in practice, you'd need to handle the specific Celtx schema
    const extractTextFromElement = (element: unknown): string => {
      if (typeof element === 'string') {
        return element;
      }
      if ((element as any)._ && typeof (element as any)._ === 'string') {
        return (element as any)._;
      }
      if (Array.isArray(element)) {
        return element.map(extractTextFromElement).join('\n');
      }
      if (typeof element === 'object' && element !== null) {
        return Object.values(element as any).map(extractTextFromElement).join('\n');
      }
      return '';
    };

    textContent = extractTextFromElement(result);

    // Basic scene detection for Celtx
    const lines = textContent.split('\n').filter(line => line.trim());
    let currentScene: Partial<ScriptScene> | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.match(/^(INT\.|EXT\.)/i)) {
        if (currentScene) {
          scenes.push(currentScene as ScriptScene);
        }
        currentScene = {
          heading: trimmed,
          action: '',
          dialogue: []
        };
      } else if (trimmed.match(/^[A-Z\s]{2,}$/) && trimmed.length < 50) {
        // Likely a character name
        characters.add(trimmed);
      }
    }

    if (currentScene) {
      scenes.push(currentScene as ScriptScene);
    }

    const structuredContent: StructuredScript = {
      type: 'structured_script',
      scenes: scenes.map((scene, index) => ({
        ...scene,
        sceneNumber: index + 1
      })),
      metadata: {
        characters: Array.from(characters),
        totalScenes: scenes.length
      }
    };

    const metadata = extractBasicMetadata(filename, textContent);
    metadata.custom = {
      sceneCount: scenes.length,
      characterCount: characters.size,
      celtxFormat: true
    };

    warnings.push({
      type: 'partial_extraction',
      message: 'Celtx parsing uses simplified extraction - some formatting may be lost',
      severity: 'low',
      suggestions: ['For better results, export as Final Draft (.fdx) format'],
      timestamp: new Date()
    });

    progressCallback?.({
      currentStep: 'Celtx parsing complete',
      progress: 100,
      details: `Extracted ${scenes.length} scenes`
    });

    return {
      textContent,
      structuredContent,
      metadata,
      warnings
    };

  } catch (error) {
    throw new Error(`Celtx parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Word Document Parser (.docx)
 * Uses mammoth.js to extract text from Word documents
 */
export async function parseWordDocument(
  filename: string,
  buffer: Buffer,
  progressCallback?: IngestionProgressCallback
): Promise<ParseResult> {
  const warnings: IngestionWarning[] = [];
  
  try {
    progressCallback?.({
      currentStep: 'Parsing Word document',
      progress: 20,
      details: 'Loading document structure'
    });

    const result = await mammoth.extractRawText({ buffer });
    const textContent = result.value;

    progressCallback?.({
      currentStep: 'Processing document content',
      progress: 60,
      details: 'Extracting text and formatting'
    });

    // Check for extraction messages/warnings
    if (result.messages && result.messages.length > 0) {
      const hasErrors = result.messages.some(msg => msg.type === 'error');
      const hasWarnings = result.messages.some(msg => msg.type === 'warning');

      if (hasErrors) {
        warnings.push({
          type: 'partial_extraction',
          message: 'Some document elements could not be processed',
          severity: 'medium',
          suggestions: [
            'Try saving the document in a newer format',
            'Check if the document has complex formatting or embedded objects'
          ],
          timestamp: new Date()
        });
      }

      if (hasWarnings) {
        warnings.push({
          type: 'unsupported_features',
          message: 'Some document features are not fully supported',
          severity: 'low',
          suggestions: ['Document content extracted but some formatting may be lost'],
          timestamp: new Date()
        });
      }
    }

    // Check for empty content
    if (!textContent || textContent.trim().length === 0) {
      warnings.push({
        type: 'empty_content',
        message: 'No text content found in the Word document',
        severity: 'high',
        suggestions: [
          'Check if the document contains only images or objects',
          'Ensure the document is not corrupted',
          'Try opening the document in Microsoft Word to verify content'
        ],
        timestamp: new Date()
      });
    }

    progressCallback?.({
      currentStep: 'Extracting metadata',
      progress: 80,
      details: 'Analyzing document metadata'
    });

    const metadata = extractBasicMetadata(filename, textContent);
    
    // Try to extract more structured information from Word doc
    const lines = textContent.split('\n').filter(line => line.trim());
    
    // Look for title in first few lines
    if (lines.length > 0 && !metadata.title) {
      metadata.title = lines[0].trim();
    }

    // Look for author information
    const authorLine = lines.find(line => 
      line.toLowerCase().includes('by ') || 
      line.toLowerCase().includes('author:') ||
      line.toLowerCase().includes('written by')
    );
    
    if (authorLine && !metadata.author) {
      const authorMatch = authorLine.match(/(?:by|author:|written by)\s*([^\n\r]+)/i);
      if (authorMatch) {
        metadata.author = authorMatch[1].trim();
      }
    }

    progressCallback?.({
      currentStep: 'Word document parsing complete',
      progress: 100,
      details: `Extracted ${textContent.length} characters`
    });

    return {
      textContent,
      metadata,
      warnings
    };

  } catch (error) {
    throw new Error(`Word document parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * PowerPoint Parser (.pptx, .ppt)
 * Extracts text from PowerPoint presentations
 */
export async function parsePowerPointFile(
  filename: string,
  buffer: Buffer,
  progressCallback?: IngestionProgressCallback
): Promise<ParseResult> {
  const warnings: IngestionWarning[] = [];
  
  try {
    progressCallback?.({
      currentStep: 'Parsing PowerPoint file',
      progress: 20,
      details: 'Extracting presentation structure'
    });

    // PowerPoint files are ZIP archives
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    let textContent = '';
    let slideCount = 0;

    // Look for slide content in ppt/slides/ directory
    const slideEntries = entries.filter(entry => 
      entry.entryName.startsWith('ppt/slides/slide') && 
      entry.entryName.endsWith('.xml')
    );

    progressCallback?.({
      currentStep: 'Processing slides',
      progress: 50,
      details: `Processing ${slideEntries.length} slides`
    });

    for (const slideEntry of slideEntries) {
      slideCount++;
      const slideXml = slideEntry.getData().toString('utf-8');
      
      try {
        const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
        const parseXML = promisify(parser.parseString.bind(parser)) as (xml: string) => Promise<unknown>;
        const slideData = await parseXML(slideXml);

        textContent += `\n--- Slide ${slideCount} ---\n`;
        
        // Extract text from slide elements
        const extractTextFromSlide = (obj: any): void => {
          if (typeof obj === 'string') {
            textContent += obj + ' ';
            return;
          }
          
          if (Array.isArray(obj)) {
            obj.forEach(extractTextFromSlide);
            return;
          }
          
          if (obj && typeof obj === 'object') {
            // Look for text content in various PowerPoint XML elements
            if (obj['a:t']) {
              textContent += obj['a:t'] + ' ';
            }
            
            Object.values(obj).forEach(extractTextFromSlide);
          }
        };

        extractTextFromSlide(slideData);
        textContent += '\n';

      } catch (_slideError) {
        warnings.push({
          type: 'partial_extraction',
          message: `Could not parse slide ${slideCount}`,
          severity: 'low',
          suggestions: ['Some slide content may be missing from extraction'],
          timestamp: new Date()
        });
      }
    }

    // Also check for notes
    const notesEntries = entries.filter(entry => 
      entry.entryName.startsWith('ppt/notesSlides/') && 
      entry.entryName.endsWith('.xml')
    );

    if (notesEntries.length > 0) {
      textContent += '\n--- Speaker Notes ---\n';
      
      for (const notesEntry of notesEntries) {
        const notesXml = notesEntry.getData().toString('utf-8');
        
        try {
          const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
          const parseXML = promisify(parser.parseString.bind(parser)) as (xml: string) => Promise<unknown>;
          const notesData = await parseXML(notesXml);

          const extractNotesText = (obj: any): void => {
            if (typeof obj === 'string') {
              textContent += obj + ' ';
              return;
            }
            
            if (Array.isArray(obj)) {
              obj.forEach(extractNotesText);
              return;
            }
            
            if (obj && typeof obj === 'object') {
              if (obj['a:t']) {
                textContent += obj['a:t'] + ' ';
              }
              Object.values(obj).forEach(extractNotesText);
            }
          };

          extractNotesText(notesData);
        } catch {
          // Ignore individual notes parsing errors
        }
      }
    }

    progressCallback?.({
      currentStep: 'Extracting metadata',
      progress: 80,
      details: 'Processing presentation metadata'
    });

    // Try to extract presentation metadata
    const corePropsEntry = entries.find(entry => 
      entry.entryName === 'docProps/core.xml'
    );

    let presentationTitle = '';
    let presentationAuthor = '';

    if (corePropsEntry) {
      try {
        const corePropsXml = corePropsEntry.getData().toString('utf-8');
        const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
        const parseXML = promisify(parser.parseString.bind(parser)) as (xml: string) => Promise<unknown>;
        const coreProps = await parseXML(corePropsXml);

        if ((coreProps as any)['cp:coreProperties']) {
          presentationTitle = (coreProps as any)['cp:coreProperties']['dc:title'] || '';
          presentationAuthor = (coreProps as any)['cp:coreProperties']['dc:creator'] || '';
        }
      } catch {
        // Ignore metadata extraction errors
      }
    }

    const metadata = extractBasicMetadata(filename, textContent);
    metadata.title = presentationTitle || metadata.title;
    metadata.author = presentationAuthor || metadata.author;
    metadata.pageCount = slideCount;
    metadata.custom = {
      slideCount: slideCount,
      hasNotes: notesEntries.length > 0,
      presentationFormat: filename.toLowerCase().endsWith('.pptx') ? 'pptx' : 'ppt'
    };

    if (textContent.trim().length === 0) {
      warnings.push({
        type: 'empty_content',
        message: 'No text content found in the presentation',
        severity: 'high',
        suggestions: [
          'Check if the presentation contains only images',
          'Ensure the presentation is not corrupted',
          'Try opening the presentation in PowerPoint to verify content'
        ],
        timestamp: new Date()
      });
    }

    progressCallback?.({
      currentStep: 'PowerPoint parsing complete',
      progress: 100,
      details: `Extracted content from ${slideCount} slides`
    });

    return {
      textContent: textContent.trim(),
      metadata,
      warnings
    };

  } catch (error) {
    throw new Error(`PowerPoint parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Main parser dispatcher
 * Routes to appropriate parser based on file type
 */
export async function parseFile(
  filename: string,
  buffer: Buffer,
  fileType: SupportedFileType,
  progressCallback?: IngestionProgressCallback
): Promise<ParseResult> {
  const startTime = Date.now();
  
  logger.fileProcessing.started(filename, buffer.length);
  
  try {
    let result: ParseResult;

    switch (fileType) {
      case '.txt':
        result = await parseTextFile(filename, buffer, progressCallback);
        break;
      case '.pdf':
        result = await parsePdfFile(filename, buffer, progressCallback);
        break;
      case '.fdx':
        result = await parseFinalDraftFile(filename, buffer, progressCallback);
        break;
      case '.celtx':
        result = await parseCeltxFile(filename, buffer, progressCallback);
        break;
      case '.docx':
        result = await parseWordDocument(filename, buffer, progressCallback);
        break;
      case '.pptx':
      case '.ppt':
        result = await parsePowerPointFile(filename, buffer, progressCallback);
        break;
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    const duration = Date.now() - startTime;
    logger.fileProcessing.completed(filename, duration);

    return result;

  } catch (error) {
    const duration = Date.now() - startTime;
    const parseError = error instanceof Error ? error : new Error('Unknown parsing error');
    logger.fileProcessing.failed(filename, parseError);
    
    throw parseError;
  }
}