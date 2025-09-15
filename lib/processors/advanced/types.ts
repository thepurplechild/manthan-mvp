/**
 * Advanced File Processing - Types and Interfaces
 *
 * Extended types for advanced processing features including content analysis,
 * security scanning, pipeline processing, and output formats.
 */

import { IngestionWarning } from '@/lib/ingestion/types';

/**
 * Advanced content analysis result
 */
export interface ContentAnalysis {
  /** Content summary */
  summary?: string;
  /** Extracted keywords */
  keywords: string[];
  /** Named entities */
  entities: NamedEntity[];
  /** Content topics */
  topics: ContentTopic[];
  /** Language analysis */
  language: LanguageAnalysis;
  /** Document structure */
  structure: DocumentStructure;
  /** Content quality metrics */
  quality: ContentQuality;
  /** Sentiment analysis */
  sentiment?: SentimentAnalysis;
  /** Content classification */
  classification: ContentClassification;
}

/**
 * Named entity recognition result
 */
export interface NamedEntity {
  /** Entity text */
  text: string;
  /** Entity type (PERSON, ORGANIZATION, LOCATION, etc.) */
  type: EntityType;
  /** Confidence score (0-1) */
  confidence: number;
  /** Start position in text */
  start: number;
  /** End position in text */
  end: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Entity types
 */
export enum EntityType {
  PERSON = 'PERSON',
  ORGANIZATION = 'ORGANIZATION',
  LOCATION = 'LOCATION',
  DATE = 'DATE',
  MONEY = 'MONEY',
  PHONE = 'PHONE',
  EMAIL = 'EMAIL',
  URL = 'URL',
  MISC = 'MISC'
}

/**
 * Content topic analysis
 */
export interface ContentTopic {
  /** Topic name */
  name: string;
  /** Relevance score (0-1) */
  score: number;
  /** Related keywords */
  keywords: string[];
  /** Topic category */
  category?: string;
}

/**
 * Language analysis result
 */
export interface LanguageAnalysis {
  /** Primary language code */
  primary: string;
  /** Language confidence (0-1) */
  confidence: number;
  /** Secondary languages detected */
  secondary: Array<{ language: string; confidence: number }>;
  /** Readability metrics */
  readability: ReadabilityMetrics;
  /** Writing style analysis */
  style: WritingStyle;
}

/**
 * Readability metrics
 */
export interface ReadabilityMetrics {
  /** Flesch Reading Ease score */
  fleschEase: number;
  /** Flesch-Kincaid Grade Level */
  fleschKincaid: number;
  /** Automated Readability Index */
  ari: number;
  /** Average sentence length */
  avgSentenceLength: number;
  /** Average syllables per word */
  avgSyllablesPerWord: number;
  /** Complexity level */
  complexity: 'elementary' | 'middle' | 'high' | 'college' | 'graduate';
}

/**
 * Writing style analysis
 */
export interface WritingStyle {
  /** Formal vs informal */
  formality: number; // -1 to 1
  /** Technical vs general */
  technicality: number; // 0 to 1
  /** Objective vs subjective */
  objectivity: number; // -1 to 1
  /** Writing tone */
  tone: WritingTone[];
  /** Dominant voice (active/passive) */
  voice: 'active' | 'passive' | 'mixed';
}

/**
 * Writing tone
 */
export interface WritingTone {
  /** Tone type */
  type: 'confident' | 'analytical' | 'joyful' | 'sad' | 'angry' | 'fear' | 'tentative';
  /** Tone strength (0-1) */
  strength: number;
}

/**
 * Document structure analysis
 */
export interface DocumentStructure {
  /** Document type */
  type: DocumentType;
  /** Hierarchical sections */
  sections: DocumentSection[];
  /** Formatting elements */
  formatting: FormattingElement[];
  /** Table of contents */
  tableOfContents?: TOCEntry[];
  /** References and citations */
  references: Reference[];
  /** Document flow score */
  flowScore: number;
}

/**
 * Document types
 */
export enum DocumentType {
  ACADEMIC_PAPER = 'ACADEMIC_PAPER',
  BUSINESS_REPORT = 'BUSINESS_REPORT',
  LEGAL_DOCUMENT = 'LEGAL_DOCUMENT',
  TECHNICAL_MANUAL = 'TECHNICAL_MANUAL',
  PRESENTATION = 'PRESENTATION',
  SCREENPLAY = 'SCREENPLAY',
  NOVEL = 'NOVEL',
  EMAIL = 'EMAIL',
  NEWS_ARTICLE = 'NEWS_ARTICLE',
  BLOG_POST = 'BLOG_POST',
  SOCIAL_MEDIA = 'SOCIAL_MEDIA',
  OTHER = 'OTHER'
}

/**
 * Document section
 */
export interface DocumentSection {
  /** Section title */
  title: string;
  /** Section level (1 = top level) */
  level: number;
  /** Section content */
  content: string;
  /** Start position */
  start: number;
  /** End position */
  end: number;
  /** Subsections */
  subsections: DocumentSection[];
}

/**
 * Formatting element
 */
export interface FormattingElement {
  /** Element type */
  type: 'bold' | 'italic' | 'underline' | 'heading' | 'list' | 'table' | 'image' | 'link';
  /** Element text */
  text: string;
  /** Position in document */
  position: number;
  /** Additional attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Table of contents entry
 */
export interface TOCEntry {
  /** Entry title */
  title: string;
  /** Page number or section number */
  page?: number;
  /** Heading level */
  level: number;
  /** Child entries */
  children: TOCEntry[];
}

/**
 * Reference or citation
 */
export interface Reference {
  /** Reference type */
  type: 'citation' | 'bibliography' | 'footnote' | 'hyperlink';
  /** Reference text */
  text: string;
  /** Target URL or identifier */
  target?: string;
  /** Position in document */
  position: number;
}

/**
 * Content quality metrics
 */
export interface ContentQuality {
  /** Overall quality score (0-100) */
  score: number;
  /** Grammar quality (0-100) */
  grammar: number;
  /** Spelling quality (0-100) */
  spelling: number;
  /** Coherence score (0-100) */
  coherence: number;
  /** Completeness score (0-100) */
  completeness: number;
  /** Quality issues */
  issues: QualityIssue[];
}

/**
 * Quality issue
 */
export interface QualityIssue {
  /** Issue type */
  type: 'grammar' | 'spelling' | 'style' | 'coherence' | 'factual' | 'structure';
  /** Issue description */
  description: string;
  /** Severity level */
  severity: 'low' | 'medium' | 'high';
  /** Position in text */
  position?: number;
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Sentiment analysis result
 */
export interface SentimentAnalysis {
  /** Overall sentiment */
  overall: SentimentScore;
  /** Sentence-level sentiment */
  sentences: SentimentScore[];
  /** Aspect-based sentiment */
  aspects: AspectSentiment[];
  /** Emotion analysis */
  emotions: EmotionScore[];
}

/**
 * Sentiment score
 */
export interface SentimentScore {
  /** Sentiment label */
  label: 'positive' | 'negative' | 'neutral';
  /** Confidence score (0-1) */
  confidence: number;
  /** Numeric score (-1 to 1) */
  score: number;
}

/**
 * Aspect-based sentiment
 */
export interface AspectSentiment {
  /** Aspect/topic */
  aspect: string;
  /** Sentiment for this aspect */
  sentiment: SentimentScore;
  /** Supporting text */
  text: string[];
}

/**
 * Emotion score
 */
export interface EmotionScore {
  /** Emotion type */
  emotion: 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'disgust';
  /** Intensity score (0-1) */
  intensity: number;
}

/**
 * Content classification
 */
export interface ContentClassification {
  /** Primary category */
  primary: ContentCategory;
  /** Secondary categories */
  secondary: ContentCategory[];
  /** Content tags */
  tags: string[];
  /** Confidence scores */
  confidence: Record<string, number>;
}

/**
 * Content category
 */
export interface ContentCategory {
  /** Category name */
  name: string;
  /** Category hierarchy */
  hierarchy: string[];
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Advanced security scan result
 */
export interface SecurityScanResult {
  /** Overall security status */
  status: 'safe' | 'warning' | 'danger';
  /** Security score (0-100) */
  score: number;
  /** Threats detected */
  threats: SecurityThreat[];
  /** Virus scan result */
  virusScan?: VirusScanResult;
  /** Content sanitization result */
  sanitization?: SanitizationResult;
  /** File validation result */
  validation: FileValidationResult;
}

/**
 * Security threat
 */
export interface SecurityThreat {
  /** Threat type */
  type: ThreatType;
  /** Threat description */
  description: string;
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Location in file */
  location?: string;
  /** Recommended action */
  action: 'quarantine' | 'sanitize' | 'block' | 'warn';
  /** Evidence */
  evidence?: string[];
}

/**
 * Threat types
 */
export enum ThreatType {
  MALWARE = 'MALWARE',
  VIRUS = 'VIRUS',
  TROJAN = 'TROJAN',
  SCRIPT_INJECTION = 'SCRIPT_INJECTION',
  MACRO_VIRUS = 'MACRO_VIRUS',
  PHISHING = 'PHISHING',
  SUSPICIOUS_LINKS = 'SUSPICIOUS_LINKS',
  DATA_EXFILTRATION = 'DATA_EXFILTRATION',
  BUFFER_OVERFLOW = 'BUFFER_OVERFLOW',
  EMBEDDED_EXECUTABLE = 'EMBEDDED_EXECUTABLE'
}

/**
 * Virus scan result
 */
export interface VirusScanResult {
  /** Scan status */
  status: 'clean' | 'infected' | 'suspicious' | 'error';
  /** Scan engine used */
  engine: string;
  /** Scan duration */
  duration: number;
  /** Viruses detected */
  detections: VirusDetection[];
  /** Scan metadata */
  metadata: Record<string, unknown>;
}

/**
 * Virus detection
 */
export interface VirusDetection {
  /** Virus name */
  name: string;
  /** Detection type */
  type: string;
  /** Confidence level */
  confidence: number;
  /** File offset */
  offset?: number;
}

/**
 * Content sanitization result
 */
export interface SanitizationResult {
  /** Sanitization performed */
  sanitized: boolean;
  /** Original content size */
  originalSize: number;
  /** Sanitized content size */
  sanitizedSize: number;
  /** Elements removed */
  removed: SanitizedElement[];
  /** Sanitized content */
  content?: string;
}

/**
 * Sanitized element
 */
export interface SanitizedElement {
  /** Element type */
  type: 'script' | 'macro' | 'link' | 'object' | 'metadata' | 'comment';
  /** Element description */
  description: string;
  /** Reason for removal */
  reason: string;
  /** Position */
  position?: number;
}

/**
 * File validation result
 */
export interface FileValidationResult {
  /** Validation status */
  status: 'valid' | 'invalid' | 'suspicious';
  /** File format validation */
  format: FormatValidation;
  /** Content validation */
  content: ContentValidation;
  /** Size validation */
  size: SizeValidation;
  /** Structural validation */
  structure: StructuralValidation;
}

/**
 * Format validation
 */
export interface FormatValidation {
  /** Format is valid */
  valid: boolean;
  /** Expected format */
  expected: string;
  /** Detected format */
  detected: string;
  /** Format confidence */
  confidence: number;
  /** Format issues */
  issues: string[];
}

/**
 * Content validation
 */
export interface ContentValidation {
  /** Content is valid */
  valid: boolean;
  /** Content type */
  type: string;
  /** Encoding validation */
  encoding: EncodingValidation;
  /** Content issues */
  issues: string[];
}

/**
 * Encoding validation
 */
export interface EncodingValidation {
  /** Encoding is valid */
  valid: boolean;
  /** Detected encoding */
  encoding: string;
  /** Encoding confidence */
  confidence: number;
  /** Encoding issues */
  issues: string[];
}

/**
 * Size validation
 */
export interface SizeValidation {
  /** Size is valid */
  valid: boolean;
  /** File size */
  size: number;
  /** Size limit */
  limit: number;
  /** Size category */
  category: 'small' | 'medium' | 'large' | 'excessive';
}

/**
 * Structural validation
 */
export interface StructuralValidation {
  /** Structure is valid */
  valid: boolean;
  /** Structural integrity */
  integrity: number; // 0-1
  /** Structural issues */
  issues: StructuralIssue[];
}

/**
 * Structural issue
 */
export interface StructuralIssue {
  /** Issue type */
  type: 'corruption' | 'truncation' | 'malformation' | 'inconsistency';
  /** Issue description */
  description: string;
  /** Severity */
  severity: 'low' | 'medium' | 'high';
  /** Location */
  location?: string;
}

/**
 * Processing pipeline configuration
 */
export interface PipelineConfig {
  /** Pipeline name */
  name: string;
  /** Pipeline description */
  description?: string;
  /** Pipeline steps */
  steps: PipelineStep[];
  /** Pipeline settings */
  settings: PipelineSettings;
  /** Conditional execution rules */
  conditions?: PipelineCondition[];
}

/**
 * Pipeline step
 */
export interface PipelineStep {
  /** Step name */
  name: string;
  /** Step type */
  type: StepType;
  /** Step configuration */
  config: StepConfig;
  /** Step dependencies */
  dependencies?: string[];
  /** Conditional execution */
  condition?: string;
  /** Error handling */
  errorHandling: ErrorHandling;
}

/**
 * Step types
 */
export enum StepType {
  PREPROCESSING = 'PREPROCESSING',
  CONTENT_EXTRACTION = 'CONTENT_EXTRACTION',
  CONTENT_ANALYSIS = 'CONTENT_ANALYSIS',
  SECURITY_SCAN = 'SECURITY_SCAN',
  TRANSFORMATION = 'TRANSFORMATION',
  VALIDATION = 'VALIDATION',
  OUTPUT_GENERATION = 'OUTPUT_GENERATION',
  NOTIFICATION = 'NOTIFICATION',
  CUSTOM = 'CUSTOM'
}

/**
 * Step configuration
 */
export interface StepConfig {
  /** Timeout for step */
  timeout?: number;
  /** Retry configuration */
  retry?: RetryConfig;
  /** Step-specific parameters */
  parameters: Record<string, unknown>;
  /** Resource limits */
  resources?: ResourceLimits;
}

/**
 * Error handling configuration
 */
export interface ErrorHandling {
  /** Strategy on error */
  strategy: 'fail' | 'skip' | 'retry' | 'fallback';
  /** Maximum retries */
  maxRetries?: number;
  /** Fallback step */
  fallbackStep?: string;
  /** Continue pipeline on error */
  continueOnError: boolean;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum retry attempts */
  maxAttempts: number;
  /** Retry delay in ms */
  delay: number;
  /** Exponential backoff */
  exponentialBackoff: boolean;
  /** Maximum delay */
  maxDelay?: number;
}

/**
 * Resource limits
 */
export interface ResourceLimits {
  /** Memory limit in MB */
  memory?: number;
  /** CPU limit percentage */
  cpu?: number;
  /** Disk space limit in MB */
  disk?: number;
  /** Network bandwidth limit */
  bandwidth?: number;
}

/**
 * Pipeline settings
 */
export interface PipelineSettings {
  /** Parallel execution */
  parallel: boolean;
  /** Pipeline timeout */
  timeout: number;
  /** Pipeline priority */
  priority: 'low' | 'medium' | 'high';
  /** Resource allocation */
  resources: ResourceLimits;
  /** Monitoring settings */
  monitoring: MonitoringSettings;
}

/**
 * Pipeline condition
 */
export interface PipelineCondition {
  /** Condition name */
  name: string;
  /** Condition expression */
  expression: string;
  /** Action if condition is met */
  action: 'execute' | 'skip' | 'branch';
  /** Target step or pipeline */
  target?: string;
}

/**
 * Monitoring settings
 */
export interface MonitoringSettings {
  /** Enable monitoring */
  enabled: boolean;
  /** Metrics to collect */
  metrics: string[];
  /** Monitoring interval */
  interval: number;
  /** Alert thresholds */
  alerts: AlertThreshold[];
}

/**
 * Alert threshold
 */
export interface AlertThreshold {
  /** Metric name */
  metric: string;
  /** Threshold value */
  threshold: number;
  /** Comparison operator */
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  /** Alert severity */
  severity: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Output format configuration
 */
export interface OutputConfig {
  /** Output formats to generate */
  formats: OutputFormat[];
  /** Output destination */
  destination: OutputDestination;
  /** Export settings */
  export?: ExportSettings;
  /** Notification settings */
  notifications?: NotificationSettings;
}

/**
 * Output format
 */
export interface OutputFormat {
  /** Format type */
  type: OutputFormatType;
  /** Format configuration */
  config: FormatConfig;
  /** Output template */
  template?: string;
  /** Post-processing steps */
  postProcessing?: PostProcessingStep[];
}

/**
 * Output format types
 */
export enum OutputFormatType {
  JSON = 'JSON',
  XML = 'XML',
  CSV = 'CSV',
  YAML = 'YAML',
  HTML = 'HTML',
  PDF = 'PDF',
  MARKDOWN = 'MARKDOWN',
  PLAIN_TEXT = 'PLAIN_TEXT',
  STRUCTURED_JSON = 'STRUCTURED_JSON',
  CUSTOM = 'CUSTOM'
}

/**
 * Format configuration
 */
export interface FormatConfig {
  /** Include metadata */
  includeMetadata: boolean;
  /** Include content analysis */
  includeAnalysis: boolean;
  /** Include security scan */
  includeSecurity: boolean;
  /** Formatting options */
  formatting: FormattingOptions;
  /** Compression settings */
  compression?: CompressionSettings;
}

/**
 * Formatting options
 */
export interface FormattingOptions {
  /** Pretty print */
  prettyPrint: boolean;
  /** Indentation */
  indent: number | string;
  /** Line ending style */
  lineEnding: 'lf' | 'crlf' | 'cr';
  /** Character encoding */
  encoding: string;
  /** Include timestamps */
  includeTimestamps: boolean;
}

/**
 * Compression settings
 */
export interface CompressionSettings {
  /** Compression algorithm */
  algorithm: 'gzip' | 'deflate' | 'brotli' | 'lz4';
  /** Compression level */
  level: number;
  /** Enable compression */
  enabled: boolean;
}

/**
 * Post-processing step
 */
export interface PostProcessingStep {
  /** Step name */
  name: string;
  /** Processing function */
  processor: (data: unknown) => unknown;
  /** Step configuration */
  config: Record<string, unknown>;
}

/**
 * Output destination
 */
export interface OutputDestination {
  /** Destination type */
  type: DestinationType;
  /** Destination configuration */
  config: DestinationConfig;
  /** Backup destinations */
  backup?: OutputDestination[];
}

/**
 * Destination types
 */
export enum DestinationType {
  FILE_SYSTEM = 'FILE_SYSTEM',
  DATABASE = 'DATABASE',
  API_ENDPOINT = 'API_ENDPOINT',
  CLOUD_STORAGE = 'CLOUD_STORAGE',
  MESSAGE_QUEUE = 'MESSAGE_QUEUE',
  WEBHOOK = 'WEBHOOK',
  EMAIL = 'EMAIL',
  CUSTOM = 'CUSTOM'
}

/**
 * Destination configuration
 */
export interface DestinationConfig {
  /** Connection details */
  connection: Record<string, unknown>;
  /** Authentication */
  auth?: AuthConfig;
  /** Retry configuration */
  retry?: RetryConfig;
  /** Transformation rules */
  transform?: TransformationRule[];
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  /** Authentication type */
  type: 'none' | 'basic' | 'bearer' | 'oauth' | 'api_key' | 'custom';
  /** Credentials */
  credentials: Record<string, unknown>;
  /** Token refresh settings */
  refresh?: RefreshConfig;
}

/**
 * Token refresh configuration
 */
export interface RefreshConfig {
  /** Auto refresh */
  autoRefresh: boolean;
  /** Refresh threshold */
  threshold: number;
  /** Refresh endpoint */
  endpoint?: string;
}

/**
 * Transformation rule
 */
export interface TransformationRule {
  /** Rule name */
  name: string;
  /** Source field */
  source: string;
  /** Target field */
  target: string;
  /** Transformation function */
  transform: string | ((value: unknown) => unknown);
  /** Condition for applying rule */
  condition?: string;
}

/**
 * Export settings
 */
export interface ExportSettings {
  /** Export enabled */
  enabled: boolean;
  /** Export schedule */
  schedule?: ScheduleConfig;
  /** Export filters */
  filters?: ExportFilter[];
  /** Export aggregation */
  aggregation?: AggregationConfig;
}

/**
 * Schedule configuration
 */
export interface ScheduleConfig {
  /** Schedule type */
  type: 'immediate' | 'delayed' | 'periodic' | 'cron';
  /** Schedule value */
  value: string | number;
  /** Schedule timezone */
  timezone?: string;
}

/**
 * Export filter
 */
export interface ExportFilter {
  /** Filter field */
  field: string;
  /** Filter operator */
  operator: string;
  /** Filter value */
  value: unknown;
  /** Filter logic */
  logic?: 'and' | 'or';
}

/**
 * Aggregation configuration
 */
export interface AggregationConfig {
  /** Aggregation type */
  type: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'group';
  /** Aggregation field */
  field: string;
  /** Group by fields */
  groupBy?: string[];
  /** Having conditions */
  having?: ExportFilter[];
}

/**
 * Notification settings
 */
export interface NotificationSettings {
  /** Notifications enabled */
  enabled: boolean;
  /** Notification channels */
  channels: NotificationChannel[];
  /** Notification triggers */
  triggers: NotificationTrigger[];
  /** Rate limiting */
  rateLimit?: RateLimitConfig;
}

/**
 * Notification channel
 */
export interface NotificationChannel {
  /** Channel type */
  type: 'webhook' | 'email' | 'sms' | 'slack' | 'teams' | 'custom';
  /** Channel configuration */
  config: ChannelConfig;
  /** Channel priority */
  priority: 'low' | 'medium' | 'high';
  /** Retry settings */
  retry?: RetryConfig;
}

/**
 * Channel configuration
 */
export interface ChannelConfig {
  /** Channel endpoint/address */
  endpoint: string;
  /** Authentication */
  auth?: AuthConfig;
  /** Message template */
  template?: string;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * Notification trigger
 */
export interface NotificationTrigger {
  /** Trigger event */
  event: 'processing_started' | 'processing_completed' | 'processing_failed' | 'security_alert' | 'quality_alert';
  /** Trigger condition */
  condition?: string;
  /** Notification content */
  content: NotificationContent;
  /** Channels to notify */
  channels: string[];
}

/**
 * Notification content
 */
export interface NotificationContent {
  /** Message subject */
  subject: string;
  /** Message body */
  body: string;
  /** Message format */
  format: 'text' | 'html' | 'markdown';
  /** Attachments */
  attachments?: NotificationAttachment[];
}

/**
 * Notification attachment
 */
export interface NotificationAttachment {
  /** Attachment name */
  name: string;
  /** Attachment type */
  type: string;
  /** Attachment data */
  data: Buffer | string;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Maximum notifications per period */
  maxNotifications: number;
  /** Rate limit period in seconds */
  period: number;
  /** Rate limit strategy */
  strategy: 'drop' | 'queue' | 'throttle';
  /** Queue size for queued strategy */
  queueSize?: number;
}

// Performance Monitoring Types

/**
 * Performance metrics for operations
 */
export interface PerformanceMetrics {
  timestamp: number;
  operationId: string;
  memoryUsage: {
    current: number;
    peak: number;
    average: number;
  };
  cpuUsage: {
    current: number;
    peak: number;
    average: number;
  };
  processingTime: number;
  throughput: number;
  errorRate: number;
  concurrent: number;
  queueSize: number;
}

/**
 * System resource usage
 */
export interface ResourceUsage {
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;
  networkUsage: number;
}

/**
 * Performance threshold configuration
 */
export interface PerformanceThresholds {
  memoryUsagePercent: number;
  cpuUsagePercent: number;
  processingTimeMs: number;
  errorRate: number;
  throughputMin: number;
}

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  id: string;
  severity: AlertSeverity;
  type: string;
  message: string;
  timestamp: Date;
  operationId?: string;
  metrics: Record<string, number>;
}

/**
 * Metric types for time series data
 */
export enum MetricType {
  MEMORY_USAGE = 'memory_usage',
  CPU_USAGE = 'cpu_usage',
  PROCESSING_TIME = 'processing_time',
  THROUGHPUT = 'throughput',
  ERROR_RATE = 'error_rate',
  SYSTEM_MEMORY = 'system_memory',
  SYSTEM_CPU = 'system_cpu'
}

/**
 * Time series data point
 */
export interface TimeSeriesData {
  timestamp: number;
  value: number;
}

/**
 * Performance report
 */
export interface PerformanceReport {
  timeRange: {
    start: Date;
    end: Date;
  };
  summary: {
    totalOperations: number;
    avgProcessingTime: number;
    maxProcessingTime: number;
    minProcessingTime: number;
    avgThroughput: number;
    avgMemoryUsage: number;
    peakMemoryUsage: number;
    avgCpuUsage: number;
    peakCpuUsage: number;
    errorRate: number;
    totalErrors: number;
  };
  alerts: PerformanceAlert[];
  trends: {
    memoryTrend: 'increasing' | 'decreasing' | 'stable';
    cpuTrend: 'increasing' | 'decreasing' | 'stable';
    throughputTrend: 'increasing' | 'decreasing' | 'stable';
    errorRateTrend: 'increasing' | 'decreasing' | 'stable';
  };
}

/**
 * Performance monitoring configuration
 */
export interface PerformanceConfig {
  retentionDays: number;
  samplingInterval: number;
  alertThresholds: PerformanceThresholds;
  enableRealTimeMonitoring: boolean;
  enablePerformanceReports: boolean;
}