import { ContentAnalyzer } from '@/lib/processors/advanced/content-analyzer';
import {
  ContentAnalysis,
  KeywordExtractionOptions,
  EntityExtractionOptions,
  SentimentAnalysisOptions
} from '@/lib/processors/advanced/types';

describe('ContentAnalyzer', () => {
  let analyzer: ContentAnalyzer;

  beforeEach(() => {
    analyzer = new ContentAnalyzer();
  });

  describe('analyzeContent', () => {
    const sampleText = `
      The quick brown fox jumps over the lazy dog. This is a sample document
      for testing content analysis capabilities. Machine learning and artificial
      intelligence are transforming how we process documents. The technology is
      advancing rapidly in natural language processing.
    `;

    it('should perform complete content analysis', async () => {
      const result = await analyzer.analyzeContent(sampleText);

      expect(result).toHaveProperty('keywords');
      expect(result).toHaveProperty('entities');
      expect(result).toHaveProperty('topics');
      expect(result).toHaveProperty('language');
      expect(result).toHaveProperty('structure');
      expect(result).toHaveProperty('quality');
      expect(result).toHaveProperty('sentiment');
      expect(result).toHaveProperty('classification');
      expect(result).toHaveProperty('summary');
    });

    it('should extract meaningful keywords', async () => {
      const result = await analyzer.analyzeContent(sampleText);

      expect(result.keywords).toBeDefined();
      expect(result.keywords.length).toBeGreaterThan(0);

      // Should contain high-relevance keywords
      const keywordTexts = result.keywords.map(k => k.keyword.toLowerCase());
      expect(keywordTexts).toContain('machine learning');
      expect(keywordTexts).toContain('artificial intelligence');
    });

    it('should detect document language', async () => {
      const result = await analyzer.analyzeContent(sampleText);

      expect(result.language.primaryLanguage).toBe('en');
      expect(result.language.confidence).toBeGreaterThan(0.8);
    });

    it('should analyze document structure', async () => {
      const result = await analyzer.analyzeContent(sampleText);

      expect(result.structure).toBeDefined();
      expect(result.structure.paragraphCount).toBeGreaterThan(0);
      expect(result.structure.sentenceCount).toBeGreaterThan(0);
      expect(result.structure.wordCount).toBeGreaterThan(0);
    });

    it('should assess content quality', async () => {
      const result = await analyzer.analyzeContent(sampleText);

      expect(result.quality).toBeDefined();
      expect(result.quality.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.quality.overallScore).toBeLessThanOrEqual(100);
      expect(result.quality.dimensions).toBeDefined();
    });

    it('should analyze sentiment', async () => {
      const result = await analyzer.analyzeContent(sampleText);

      expect(result.sentiment).toBeDefined();
      expect(result.sentiment.overall).toBeGreaterThanOrEqual(-1);
      expect(result.sentiment.overall).toBeLessThanOrEqual(1);
      expect(result.sentiment.confidence).toBeGreaterThanOrEqual(0);
      expect(result.sentiment.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle empty text gracefully', async () => {
      const result = await analyzer.analyzeContent('');

      expect(result.keywords).toHaveLength(0);
      expect(result.entities).toHaveLength(0);
      expect(result.structure.wordCount).toBe(0);
    });

    it('should respect custom options', async () => {
      const options = {
        keywords: { maxCount: 5, minScore: 0.8 } as KeywordExtractionOptions,
        entities: { types: ['PERSON', 'ORGANIZATION'] } as EntityExtractionOptions,
        sentiment: { includeEmotions: true } as SentimentAnalysisOptions
      };

      const result = await analyzer.analyzeContent(sampleText, {}, options);

      expect(result.keywords.length).toBeLessThanOrEqual(5);
      expect(result.sentiment.emotions).toBeDefined();
    });
  });

  describe('extractKeywords', () => {
    it('should extract relevant keywords with scores', async () => {
      const text = 'Machine learning algorithms are used in artificial intelligence applications';
      const keywords = await analyzer.extractKeywords(text);

      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords[0]).toHaveProperty('keyword');
      expect(keywords[0]).toHaveProperty('score');
      expect(keywords[0]).toHaveProperty('frequency');
      expect(keywords[0].score).toBeGreaterThan(0);
    });

    it('should respect maxCount option', async () => {
      const text = 'Machine learning algorithms are used in artificial intelligence applications for data science';
      const options: KeywordExtractionOptions = { maxCount: 3 };

      const keywords = await analyzer.extractKeywords(text, options);

      expect(keywords.length).toBeLessThanOrEqual(3);
    });

    it('should filter by minimum score', async () => {
      const text = 'The quick brown fox jumps over the lazy dog';
      const options: KeywordExtractionOptions = { minScore: 0.8 };

      const keywords = await analyzer.extractKeywords(text, options);

      keywords.forEach(keyword => {
        expect(keyword.score).toBeGreaterThanOrEqual(0.8);
      });
    });
  });

  describe('extractEntities', () => {
    it('should extract named entities with types', async () => {
      const text = 'John Smith works at Google in San Francisco';
      const entities = await analyzer.extractEntities(text);

      expect(entities.length).toBeGreaterThan(0);

      const entityTypes = entities.map(e => e.type);
      expect(entityTypes).toContain('PERSON');
      expect(entityTypes).toContain('ORGANIZATION');
      expect(entityTypes).toContain('LOCATION');
    });

    it('should filter by entity types', async () => {
      const text = 'John Smith works at Google in San Francisco';
      const options: EntityExtractionOptions = { types: ['PERSON'] };

      const entities = await analyzer.extractEntities(text, options);

      entities.forEach(entity => {
        expect(entity.type).toBe('PERSON');
      });
    });

    it('should include confidence scores', async () => {
      const text = 'Apple Inc. is a technology company';
      const entities = await analyzer.extractEntities(text);

      entities.forEach(entity => {
        expect(entity.confidence).toBeGreaterThan(0);
        expect(entity.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('extractTopics', () => {
    it('should identify document topics', async () => {
      const text = `
        Machine learning is a subset of artificial intelligence. It enables computers
        to learn patterns from data without explicit programming. Deep learning uses
        neural networks with multiple layers to process information.
      `;

      const topics = await analyzer.extractTopics(text);

      expect(topics.length).toBeGreaterThan(0);
      expect(topics[0]).toHaveProperty('topic');
      expect(topics[0]).toHaveProperty('score');
      expect(topics[0]).toHaveProperty('keywords');
    });

    it('should rank topics by relevance', async () => {
      const text = 'Artificial intelligence and machine learning are related technologies';
      const topics = await analyzer.extractTopics(text);

      if (topics.length > 1) {
        expect(topics[0].score).toBeGreaterThanOrEqual(topics[1].score);
      }
    });
  });

  describe('analyzeSentiment', () => {
    it('should analyze positive sentiment', async () => {
      const text = 'This is an excellent product with amazing features that I absolutely love!';
      const sentiment = await analyzer.analyzeSentiment(text);

      expect(sentiment.overall).toBeGreaterThan(0);
      expect(sentiment.label).toBe('positive');
    });

    it('should analyze negative sentiment', async () => {
      const text = 'This is a terrible product with horrible features that I hate!';
      const sentiment = await analyzer.analyzeSentiment(text);

      expect(sentiment.overall).toBeLessThan(0);
      expect(sentiment.label).toBe('negative');
    });

    it('should analyze neutral sentiment', async () => {
      const text = 'This is a document about technical specifications and requirements.';
      const sentiment = await analyzer.analyzeSentiment(text);

      expect(Math.abs(sentiment.overall)).toBeLessThan(0.3);
      expect(sentiment.label).toBe('neutral');
    });

    it('should include emotion analysis when requested', async () => {
      const text = 'I am so excited about this new technology!';
      const options: SentimentAnalysisOptions = { includeEmotions: true };

      const sentiment = await analyzer.analyzeSentiment(text, options);

      expect(sentiment.emotions).toBeDefined();
      expect(sentiment.emotions!.joy).toBeGreaterThan(0);
    });
  });

  describe('detectLanguage', () => {
    it('should detect English text', async () => {
      const text = 'This is a text written in English language';
      const result = await analyzer.detectLanguage(text);

      expect(result.primaryLanguage).toBe('en');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should handle mixed languages', async () => {
      const text = 'Hello world. Bonjour le monde. Hola mundo.';
      const result = await analyzer.detectLanguage(text);

      expect(result.languages.length).toBeGreaterThan(1);
      expect(result.languages).toContainEqual(
        expect.objectContaining({ code: 'en' })
      );
    });

    it('should return low confidence for ambiguous text', async () => {
      const text = '123 456 789';
      const result = await analyzer.detectLanguage(text);

      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('generateSummary', () => {
    it('should generate concise summary', async () => {
      const longText = `
        Machine learning is a method of data analysis that automates analytical model building.
        It is a branch of artificial intelligence based on the idea that systems can learn from data,
        identify patterns and make decisions with minimal human intervention. Machine learning algorithms
        build mathematical models based on training data in order to make predictions or decisions without
        being explicitly programmed to do so. Machine learning algorithms are used in a wide variety of
        applications, such as email filtering and computer vision, where it is difficult or infeasible
        to develop conventional algorithms to perform the needed tasks.
      `;

      const summary = await analyzer.generateSummary(longText);

      expect(summary.text).toBeDefined();
      expect(summary.text.length).toBeLessThan(longText.length);
      expect(summary.sentences.length).toBeGreaterThan(0);
      expect(summary.compressionRatio).toBeGreaterThan(0);
      expect(summary.compressionRatio).toBeLessThan(1);
    });

    it('should respect target length', async () => {
      const text = 'This is a sample text for summarization testing purposes with multiple sentences to work with.';
      const options = { targetLength: 50 };

      const summary = await analyzer.generateSummary(text, options);

      expect(summary.text.length).toBeLessThanOrEqual(60); // Allow some flexibility
    });
  });

  describe('error handling', () => {
    it('should handle malformed text gracefully', async () => {
      const malformedText = '\x00\x01\x02invalid\x03\x04';

      const result = await analyzer.analyzeContent(malformedText);

      expect(result).toBeDefined();
      expect(result.keywords).toBeDefined();
      expect(result.entities).toBeDefined();
    });

    it('should handle extremely long text', async () => {
      const longText = 'word '.repeat(10000);

      const result = await analyzer.analyzeContent(longText);

      expect(result).toBeDefined();
      expect(result.structure.wordCount).toBe(10000);
    });
  });
});