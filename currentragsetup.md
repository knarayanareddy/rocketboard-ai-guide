# Current RAG Setup for RocketBoard

RocketBoard currently utilizes a standard, linear Retrieval-Augmented Generation (RAG) architecture. Below is a detailed breakdown of the system across the ingestion, retrieval, and generation phases.

## 1. Ingestion and Indexing
- **Sources**: Includes GitHub Repositories, Notion pages, Confluence, Jira, Slack, Linear, PagerDuty, URLs, and OpenAPI definitions.
- **Chunking Strategy**: 
  - **Code/Text**: Implements a simple fixed-size sliding window chunking algorithm. For instance, code and text files are split by lines using the `chunkLines` (e.g., 120 lines with 10-line overlap) or `chunkWords` functions.
  - No Abstract Syntax Tree (AST) parsing or syntax-aware chunking is implemented. Therefore, chunks may split right through the middle of a class, function, or semantic block.
- **Storage & Embeddings**:
  - Raw chunks are stored in the PostgreSQL database in the `knowledge_chunks` table.
  - Embeddings are generated per chunk before saving to the database using `pgvector` (`vector(1536)` or standard dimensions relative to provider). 
  - A `fts` (Full-Text Search) column using PostgreSQL's `tsvector` is maintained for basic lexical searches.
- **Preprocessing**: 
  - Employs a robust regex-based redaction engine (e.g., stripping AWS keys, API secrets, JWTs) before embedding chunks, ensuring that secrets don't leak into the embedding model or responses.
  - Adds minimal metadata (e.g., `path`, `source_type`, `setup_category`). 

## 2. Retrieval
- **Dual Paths**: RocketBoard currently splits retrieval into "Semantic Retrieval" (for generating content via `ai-task-router`) and "Universal Search" (for the global search bar via `search-content`).
- **Semantic Retrieval (`retrieve-spans`)**:
  - Handles finding knowledge for AI generation (modules, chat, etc.).
  - Converts user instructions into embedding vectors (via standard embedding endpoints like `text-embedding-3`).
  - Queries `match_knowledge_chunks` to perform cosine similarity vector search over the `knowledge_chunks` table.
- **Universal Search (`search-content`)**:
  - Uses basic PostgreSQL Full-Text Search (`textSearch` with `tsQuery`).
  - Retrieves from multiple textual tables (`knowledge_chunks`, `generated_modules`, `generated_glossaries`, `learner_notes`, `chat_messages`).
  - Uses simple keyword containment (e.g., `.includes()`) for filtering metadata.
- **Missing Elements**: No reranking (e.g., Cohere/Cross-Encoders), no graph expansion for relationships (like code imports/dependencies), and no dynamic weighting between vectors and keywords.

## 3. Generation (`ai-task-router`)
- **Model Interface**:
  - Interfaces standardly with Gemini, OpenAI, or Anthropic.
  - Accepts a `system_prompt`, `user_instructions`, and `evidence_spans`.
- **Context Injection**: 
  - Top `K` retrieved results are linearly concatenated and stuffed into the `<context>` blocks of the system prompt.
  - Truncation limit: Enforces a strict 100,000-character ceiling on retrieved spans to fit context windows. 
- **Prompting**:
  - System prompts instruct the model on role and constraints, but rely heavily on generic statements like "use the provided context." It lacks stringent citation coercion strategies. 

## 4. Verification and Fallback
- **Evaluation**: Verification does not exist contextually post-generation. Once the LLM generates the markdown module, it is directly pushed to the user interface.
- **Fallbacks**: If the LLM generates fabricated (hallucinated) codebase details due to a lack of exact vector context, the application has no verification check to catch this before it reaches the user.
