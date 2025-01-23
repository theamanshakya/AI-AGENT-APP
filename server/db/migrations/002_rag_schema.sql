-- First attempt to create the extension
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create vector extension, falling back to array implementation';
END
$$;

-- Create the embeddings table with conditional logic
DO $$
BEGIN
    -- Check if table exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables WHERE tablename = 'document_embeddings'
    ) THEN
        -- Check if vector extension is actually available
        IF EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'vector'
        ) THEN
            -- Vector extension is available, create table with vector type
            CREATE TABLE document_embeddings (
                id SERIAL PRIMARY KEY,
                agent_id INTEGER REFERENCES ai_agents(id),
                content TEXT NOT NULL,
                embedding vector(1536),
                metadata JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- Create vector index
            CREATE INDEX ON document_embeddings 
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100);

            RAISE NOTICE 'Created document_embeddings table with vector type';
        ELSE
            -- Fallback to array implementation
            CREATE TABLE document_embeddings (
                id SERIAL PRIMARY KEY,
                agent_id INTEGER REFERENCES ai_agents(id),
                content TEXT NOT NULL,
                embedding float8[],
                metadata JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- Create basic index
            CREATE INDEX ON document_embeddings(agent_id);

            RAISE NOTICE 'Created document_embeddings table with array type';
        END IF;
    ELSE
        RAISE NOTICE 'Table document_embeddings already exists, skipping creation';
        
        -- Optionally check and modify existing table structure if needed
        -- For example, you might want to add new columns or indexes
    END IF;
END
$$; 